// Package main provides the entry point for the CLI Proxy API server.
// This server acts as a proxy that provides OpenAI/Gemini/Claude compatible API interfaces
// for CLI models, allowing CLI models to be used with tools and libraries designed for standard AI APIs.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/cmd"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/logging"
	_ "github.com/router-for-me/CLIProxyAPI/v6/internal/translator"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/usage"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	sdkAuth "github.com/router-for-me/CLIProxyAPI/v6/sdk/auth"
	log "github.com/sirupsen/logrus"
)

var (
	Version   = "dev"
	Commit    = "none"
	BuildDate = "unknown"
)

// init initializes the shared logger setup.
func init() {
	logging.SetupBaseLogger()
}

// main is the entry point of the application.
// It parses command-line flags, loads configuration, and starts the appropriate
// service based on the provided flags (login, codex-login, or server mode).
func main() {
	fmt.Printf("CLIProxyAPI Version: %s, Commit: %s, BuiltAt: %s\n", Version, Commit, BuildDate)

	// Command-line flags to control the application's behavior.
	var login bool
	var codexLogin bool
	var claudeLogin bool
	var qwenLogin bool
	var geminiWebAuth bool
	var noBrowser bool
	var projectID string
	var configPath string
	var password string

	// Define command-line flags for different operation modes.
	flag.BoolVar(&login, "login", false, "Login Google Account")
	flag.BoolVar(&codexLogin, "codex-login", false, "Login to Codex using OAuth")
	flag.BoolVar(&claudeLogin, "claude-login", false, "Login to Claude using OAuth")
	flag.BoolVar(&qwenLogin, "qwen-login", false, "Login to Qwen using OAuth")
	flag.BoolVar(&geminiWebAuth, "gemini-web-auth", false, "Auth Gemini Web using cookies")
	flag.BoolVar(&noBrowser, "no-browser", false, "Don't open browser automatically for OAuth")
	flag.StringVar(&projectID, "project_id", "", "Project ID (Gemini only, not required)")
	flag.StringVar(&configPath, "config", "", "Configure File Path")
	flag.StringVar(&password, "password", "", "")

	flag.CommandLine.Usage = func() {
		out := flag.CommandLine.Output()
		_, _ = fmt.Fprintf(out, "Usage of %s\n", os.Args[0])
		flag.CommandLine.VisitAll(func(f *flag.Flag) {
			if f.Name == "password" {
				return
			}
			s := fmt.Sprintf("  -%s", f.Name)
			name, usage := flag.UnquoteUsage(f)
			if name != "" {
				s += " " + name
			}
			if len(s) <= 4 {
				s += "	"
			} else {
				s += "\n    "
			}
			if usage != "" {
				s += usage
			}
			if f.DefValue != "" && f.DefValue != "false" && f.DefValue != "0" {
				s += fmt.Sprintf(" (default %s)", f.DefValue)
			}
			_, _ = fmt.Fprint(out, s+"\n")
		})
	}

	// Parse the command-line flags.
	flag.Parse()

	// Core application variables.
	var err error
	var cfg *config.Config
	var wd string

	// Determine and load the configuration file.
	// If a config path is provided via flags, it is used directly.
	// Otherwise, it defaults to "config.yaml" in the current working directory.
	var configFilePath string
	if configPath != "" {
		configFilePath = configPath
		cfg, err = config.LoadConfig(configPath)
	} else {
		wd, err = os.Getwd()
		if err != nil {
			log.Fatalf("failed to get working directory: %v", err)
		}
		configFilePath = filepath.Join(wd, "config.yaml")
		cfg, err = config.LoadConfig(configFilePath)
	}
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}
	usage.SetStatisticsEnabled(cfg.UsageStatisticsEnabled)

	if err = logging.ConfigureLogOutput(cfg.LoggingToFile); err != nil {
		log.Fatalf("failed to configure log output: %v", err)
	}

	log.Infof("CLIProxyAPI Version: %s, Commit: %s, BuiltAt: %s", Version, Commit, BuildDate)

	// Set the log level based on the configuration.
	util.SetLogLevel(cfg)

	if resolvedAuthDir, errResolveAuthDir := util.ResolveAuthDir(cfg.AuthDir); errResolveAuthDir != nil {
		log.Fatalf("failed to resolve auth directory: %v", errResolveAuthDir)
	} else {
		cfg.AuthDir = resolvedAuthDir
	}

	// Create login options to be used in authentication flows.
	options := &cmd.LoginOptions{
		NoBrowser: noBrowser,
	}

	// Register the shared token store once so all components use the same persistence backend.
	sdkAuth.RegisterTokenStore(sdkAuth.NewFileTokenStore())

	// Handle different command modes based on the provided flags.

	if login {
		// Handle Google/Gemini login
		cmd.DoLogin(cfg, projectID, options)
	} else if codexLogin {
		// Handle Codex login
		cmd.DoCodexLogin(cfg, options)
	} else if claudeLogin {
		// Handle Claude login
		cmd.DoClaudeLogin(cfg, options)
	} else if qwenLogin {
		cmd.DoQwenLogin(cfg, options)
	} else if geminiWebAuth {
		cmd.DoGeminiWebAuth(cfg)
	} else {
		// Start the main proxy service
		cmd.StartService(cfg, configFilePath, password)
	}
}
