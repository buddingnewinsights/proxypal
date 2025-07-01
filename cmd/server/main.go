package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/luispater/CLIProxyAPI/internal/api"
	"github.com/luispater/CLIProxyAPI/internal/auth"
	"github.com/luispater/CLIProxyAPI/internal/client"
	"github.com/luispater/CLIProxyAPI/internal/config"
	log "github.com/sirupsen/logrus"
	"io/fs"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

type LogFormatter struct {
}

func (m *LogFormatter) Format(entry *log.Entry) ([]byte, error) {
	var b *bytes.Buffer
	if entry.Buffer != nil {
		b = entry.Buffer
	} else {
		b = &bytes.Buffer{}
	}

	timestamp := entry.Time.Format("2006-01-02 15:04:05")
	var newLog string
	newLog = fmt.Sprintf("[%s] [%s] [%s:%d] %s\n", timestamp, entry.Level, path.Base(entry.Caller.File), entry.Caller.Line, entry.Message)

	b.WriteString(newLog)
	return b.Bytes(), nil
}

func init() {
	log.SetOutput(os.Stdout)
	log.SetReportCaller(true)
	log.SetFormatter(&LogFormatter{})
}

func main() {
	var login bool
	var projectID string
	var configPath string

	flag.BoolVar(&login, "login", false, "Login Google Account")
	flag.StringVar(&projectID, "project_id", "", "Project ID")
	flag.StringVar(&configPath, "config", "", "Configure File Path")

	flag.Parse()

	var err error
	var cfg *config.Config
	var wd string

	if configPath != "" {
		cfg, err = config.LoadConfig(configPath)
	} else {
		wd, err = os.Getwd()
		if err != nil {
			log.Fatalf("failed to get working directory: %v", err)
		}
		cfg, err = config.LoadConfig(path.Join(wd, "config.yaml"))
	}
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if cfg.Debug {
		log.SetLevel(log.DebugLevel)
	} else {
		log.SetLevel(log.InfoLevel)
	}

	if strings.HasPrefix(cfg.AuthDir, "~") {
		home, errUserHomeDir := os.UserHomeDir()
		if errUserHomeDir != nil {
			log.Fatalf("failed to get home directory: %v", errUserHomeDir)
		}
		parts := strings.Split(cfg.AuthDir, string(os.PathSeparator))
		if len(parts) > 1 {
			parts[0] = home
			cfg.AuthDir = path.Join(parts...)
		} else {
			cfg.AuthDir = home
		}
	}

	if login {
		var ts auth.TokenStorage
		if projectID != "" {
			ts.ProjectID = projectID
		}

		// 2. Initialize authenticated HTTP Client
		clientCtx := context.Background()

		log.Info("Initializing authentication...")
		httpClient, errGetClient := auth.GetAuthenticatedClient(clientCtx, &ts, cfg.AuthDir)
		if errGetClient != nil {
			log.Fatalf("failed to get authenticated client: %v", errGetClient)
			return
		}
		log.Info("Authentication successful.")

		// 3. Initialize CLI Client
		cliClient := client.NewClient(httpClient)
		if err = cliClient.SetupUser(clientCtx, ts.Email, projectID); err != nil {
			if err.Error() == "failed to start user onboarding, need define a project id" {
				log.Error("failed to start user onboarding")
				project, errGetProjectList := cliClient.GetProjectList(clientCtx)
				if errGetProjectList != nil {
					log.Fatalf("failed to complete user setup: %v", err)
				} else {
					log.Infof("Your account %s needs specify a project id.", ts.Email)
					log.Info("========================================================================")
					for i := 0; i < len(project.Projects); i++ {
						log.Infof("Project ID: %s", project.Projects[i].ProjectID)
						log.Infof("Project Name: %s", project.Projects[i].Name)
						log.Info("========================================================================")
					}
					log.Infof("Please run this command to login again:\n\n%s --login --project_id <project_id>\n", os.Args[0])
				}
			} else {
				// Log as a warning because in some cases, the CLI might still be usable
				// or the user might want to retry setup later.
				log.Fatalf("failed to complete user setup: %v", err)
			}
		}
	} else {
		// Create API server configuration
		apiConfig := &api.ServerConfig{
			Port:    fmt.Sprintf("%d", cfg.Port),
			Debug:   cfg.Debug,
			ApiKeys: cfg.ApiKeys,
		}

		cliClients := make([]*client.Client, 0)
		err = filepath.Walk(cfg.AuthDir, func(path string, info fs.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if !info.IsDir() && strings.HasSuffix(info.Name(), ".json") {
				log.Debugf(path)
				f, errOpen := os.Open(path)
				if errOpen != nil {
					return errOpen
				}
				defer func() {
					_ = f.Close()
				}()

				var ts auth.TokenStorage
				if err = json.NewDecoder(f).Decode(&ts); err == nil {
					// 2. Initialize authenticated HTTP Client
					clientCtx := context.Background()

					log.Info("Initializing authentication...")
					httpClient, errGetClient := auth.GetAuthenticatedClient(clientCtx, &ts, cfg.AuthDir)
					if errGetClient != nil {
						log.Fatalf("failed to get authenticated client: %v", errGetClient)
						return errGetClient
					}
					log.Info("Authentication successful.")

					// 3. Initialize CLI Client
					cliClient := client.NewClient(httpClient)
					if err = cliClient.SetupUser(clientCtx, ts.Email, ts.ProjectID); err != nil {
						if err.Error() == "failed to start user onboarding, need define a project id" {
							log.Error("failed to start user onboarding")
							project, errGetProjectList := cliClient.GetProjectList(clientCtx)
							if errGetProjectList != nil {
								log.Fatalf("failed to complete user setup: %v", err)
							} else {
								log.Infof("Your account %s needs specify a project id.", ts.Email)
								log.Info("========================================================================")
								for i := 0; i < len(project.Projects); i++ {
									log.Infof("Project ID: %s", project.Projects[i].ProjectID)
									log.Infof("Project Name: %s", project.Projects[i].Name)
									log.Info("========================================================================")
								}
								log.Infof("Please run this command to login again:\n\n%s --login --project_id <project_id>\n", os.Args[0])
							}
						} else {
							// Log as a warning because in some cases, the CLI might still be usable
							// or the user might want to retry setup later.
							log.Fatalf("failed to complete user setup: %v", err)
						}
					} else {
						cliClients = append(cliClients, cliClient)
					}
				}
			}
			return nil
		})

		// Create API server
		apiServer := api.NewServer(apiConfig, cliClients)
		log.Infof("Starting API server on port %s", apiConfig.Port)
		if err = apiServer.Start(); err != nil {
			log.Fatalf("API server failed to start: %v", err)
			return
		}

		// Set up graceful shutdown
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

		for {
			select {
			case <-sigChan:
				log.Debugf("Received shutdown signal. Cleaning up...")

				// Create shutdown context
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				_ = ctx // Mark ctx as used to avoid error, as apiServer.Stop(ctx) is commented out

				// Stop API server
				if err = apiServer.Stop(ctx); err != nil {
					log.Debugf("Error stopping API server: %v", err)
				}
				cancel()

				log.Debugf("Cleanup completed. Exiting...")
				os.Exit(0)
			case <-time.After(5 * time.Second):

			}
		}
	}

}
