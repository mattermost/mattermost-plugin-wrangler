package main

import (
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"

	"github.com/pkg/errors"
)

const (
	permittedUserSystemAdmins         = "system-admins"
	permittedUserSystemAdminsAndEmail = "system-admins-and-email-domain"
	permittedUserAllUsers             = "all-users"
)

// configuration captures the plugin's external configuration as exposed in the Mattermost server
// configuration, as well as values computed from the configuration. Any public fields will be
// deserialized from the Mattermost server configuration in OnConfigurationChange.
//
// As plugins are inherently concurrent (hooks being called asynchronously), and the plugin
// configuration can change at any time, access to the configuration must be synchronized. The
// strategy used in this plugin is to guard a pointer to the configuration, and clone the entire
// struct whenever it changes. You may replace this with whatever strategy you choose.
//
// If you add non-reference types to your configuration struct, be sure to rewrite Clone as a deep
// copy appropriate for your types.
type configuration struct {
	PermittedWranglerUsers string
	AllowedEmailDomain     string

	EnableWebUI               bool
	CommandAutoCompleteEnable bool

	MoveThreadMaxCount                       string
	MoveThreadToAnotherTeamEnable            bool
	MoveThreadFromPrivateChannelEnable       bool
	MoveThreadFromDirectMessageChannelEnable bool
	MoveThreadFromGroupMessageChannelEnable  bool
	MergeThreadEnable                        bool

	ThreadAttachMessage string
	MoveThreadMessage   string
	CopyThreadMessage   string
}

// Clone shallow copies the configuration. Your implementation may require a deep copy if
// your configuration has reference types.
func (c *configuration) Clone() *configuration {
	var clone = *c
	return &clone
}

func (c *configuration) IsValid() error {
	var err error

	if len(c.AllowedEmailDomain) != 0 {
		emailDomains := strings.Split(c.AllowedEmailDomain, ",")
		for _, emailDomain := range emailDomains {
			if len(emailDomain) == 0 {
				return errors.New("AllowedEmailDomain has a trailing comma")
			}
			_, err = url.Parse(emailDomain)
			if err != nil {
				return errors.Wrapf(err, "invalid AllowedEmailDomain value %s", emailDomain)
			}
		}
	}

	_, err = parseAndValidateMaxThreadCountMoveSize(c.MoveThreadMaxCount)
	if err != nil {
		return errors.Wrap(err, "invalid MoveThreadMaxSize")
	}

	return nil
}

func (c *configuration) MaxThreadCountMoveSizeInt() int {
	// Use the parseAndValidate function, but ignore the error.
	i, _ := parseAndValidateMaxThreadCountMoveSize(c.MoveThreadMaxCount)

	return i
}

// parseAndValidateMaxThreadCountMoveSize parses the max thread size config
// value and returns an error if the value is invalid or cannot be parsed.
// If MaxThreadCountMoveSize is not configured, set it to 0 which stands for
// unlimited thread message count.
func parseAndValidateMaxThreadCountMoveSize(s string) (int, error) {
	if len(s) == 0 {
		return 0, nil
	}

	maxCount, err := strconv.Atoi(s)
	if err != nil {
		return 0, errors.Wrapf(err, "MoveThreadMaxSize value %s is not a valid integer", s)
	}
	if maxCount < 1 {
		return 0, fmt.Errorf("MoveThreadMaxSize (%d) must be greater than 0", maxCount)
	}

	return maxCount, nil
}

// getConfiguration retrieves the active configuration under lock, making it safe to use
// concurrently. The active configuration may change underneath the client of this method, but
// the struct returned by this API call is considered immutable.
func (p *Plugin) getConfiguration() *configuration {
	p.configurationLock.RLock()
	defer p.configurationLock.RUnlock()

	if p.configuration == nil {
		return &configuration{}
	}

	return p.configuration
}

// setConfiguration replaces the active configuration under lock.
//
// Do not call setConfiguration while holding the configurationLock, as sync.Mutex is not
// reentrant. In particular, avoid using the plugin API entirely, as this may in turn trigger a
// hook back into the plugin. If that hook attempts to acquire this lock, a deadlock may occur.
//
// This method panics if setConfiguration is called with the existing configuration. This almost
// certainly means that the configuration was modified without being cloned and may result in
// an unsafe access.
func (p *Plugin) setConfiguration(configuration *configuration) {
	p.configurationLock.Lock()
	defer p.configurationLock.Unlock()

	if configuration != nil && p.configuration == configuration {
		// Ignore assignment if the configuration struct is empty. Go will optimize the
		// allocation for same to point at the same memory address, breaking the check
		// above.
		if reflect.ValueOf(*configuration).NumField() == 0 {
			return
		}

		panic("setConfiguration called with the existing configuration")
	}

	p.configuration = configuration
}

// OnConfigurationChange is invoked when configuration changes may have been made.
func (p *Plugin) OnConfigurationChange() error {
	var configuration = new(configuration)

	// Load the public configuration fields from the Mattermost server configuration.
	if err := p.API.LoadPluginConfiguration(configuration); err != nil {
		return errors.Wrap(err, "failed to load plugin configuration")
	}

	p.setConfiguration(configuration)

	return p.API.RegisterCommand(getCommand(
		configuration.CommandAutoCompleteEnable,
		configuration.MergeThreadEnable,
	))
}
