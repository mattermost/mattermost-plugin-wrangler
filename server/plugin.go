package main

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	BotUserID string

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration
}

// BuildHash is the full git hash of the build.
var BuildHash string

// BuildHashShort is the short git hash of the build.
var BuildHashShort string

// BuildDate is the build date of the build.
var BuildDate string

// OnActivate runs when the plugin activates and ensures the plugin is properly
// configured.
func (p *Plugin) OnActivate() error {
	config := p.getConfiguration()
	err := config.IsValid()
	if err != nil {
		return errors.Wrap(err, "invalid config")
	}

	bot := &model.Bot{
		Username:    "wrangler",
		DisplayName: "Wrangler",
		Description: "Created by the Wrangler plugin.",
	}

	botID, ensureErr := p.API.EnsureBotUser(bot)
	if ensureErr != nil {
		return errors.Wrap(ensureErr, "failed to ensure Wrangler bot")
	}
	p.BotUserID = botID

	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return errors.Wrap(err, "failed to get bundle path")
	}
	profileImage, err := os.ReadFile(filepath.Join(bundlePath, "assets", "profile.png"))
	if err != nil {
		p.API.LogWarn("Failed to read profile image", "err", err.Error())
	} else {
		if appErr := p.API.SetProfileImage(botID, profileImage); appErr != nil {
			p.API.LogWarn("Failed to set profile image for bot", "err", appErr.Error())
		}
	}

	err = p.API.RegisterCommand(getCommand(
		config.CommandAutoCompleteEnable,
		config.MergeThreadEnable,
	))
	if err != nil {
		return errors.Wrap(err, "failed to register wrangler command")
	}

	return nil
}
