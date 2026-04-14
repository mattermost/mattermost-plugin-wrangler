package main

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetConfiguration(t *testing.T) {
	t.Run("reads live from LoadPluginConfiguration", func(t *testing.T) {
		// Deliberately do NOT call plugin.setConfiguration — if getConfiguration()
		// reads from the cache instead of the live store, this test will fail.
		expected := &configuration{
			PermittedWranglerUsers: permittedUserAllUsers,
			MoveThreadMaxCount:     "50",
			EnableWebUI:            true,
		}

		api := &plugintest.API{}
		api.On("LoadPluginConfiguration", mock.Anything).Return(nil).Run(func(args mock.Arguments) {
			cfg := args.Get(0).(*configuration)
			*cfg = *expected
		})

		var plugin Plugin
		plugin.SetAPI(api)

		got := plugin.getConfiguration()

		assert.Equal(t, expected.PermittedWranglerUsers, got.PermittedWranglerUsers)
		assert.Equal(t, expected.MoveThreadMaxCount, got.MoveThreadMaxCount)
		assert.Equal(t, expected.EnableWebUI, got.EnableWebUI)
		api.AssertExpectations(t)
	})

	t.Run("returns empty config on LoadPluginConfiguration error", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("LoadPluginConfiguration", mock.Anything).Return(errors.New("store unavailable"))
		api.On("LogError",
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
		).Return(nil)

		var plugin Plugin
		plugin.SetAPI(api)

		got := plugin.getConfiguration()

		assert.NotNil(t, got)
		assert.Equal(t, "", got.PermittedWranglerUsers)
		api.AssertExpectations(t)
	})
}

func TestConfigurationIsValid(t *testing.T) {
	baseConfiguration := configuration{
		AllowedEmailDomain: "mattermost.com",
		MoveThreadMaxCount: "10",
	}

	t.Run("valid", func(t *testing.T) {
		require.NoError(t, baseConfiguration.IsValid())
	})

	t.Run("AllowedEmailDomain", func(t *testing.T) {
		config := baseConfiguration

		t.Run("empty", func(t *testing.T) {
			config.AllowedEmailDomain = ""
			require.NoError(t, config.IsValid())
		})
		t.Run("full email", func(t *testing.T) {
			config.AllowedEmailDomain = "user@mattermost.com"
			require.NoError(t, config.IsValid())
		})
		t.Run("multiple domains", func(t *testing.T) {
			config.AllowedEmailDomain = "mattermost.com,google.com"
			require.NoError(t, config.IsValid())
		})
		t.Run("trailing comma", func(t *testing.T) {
			config.AllowedEmailDomain = "mattermost.com,google.com,"
			require.Error(t, config.IsValid())
		})
	})

	t.Run("MaxThreadCountMoveSize", func(t *testing.T) {
		config := baseConfiguration

		t.Run("invalid integer", func(t *testing.T) {
			config.MoveThreadMaxCount = "twenty"
			require.Error(t, config.IsValid())
		})

		t.Run("negative integer", func(t *testing.T) {
			config.MoveThreadMaxCount = "-10"
			err := config.IsValid()
			if err == nil {
				t.Log("WTF")
			}
			t.Log(config.MaxThreadCountMoveSizeInt())
			require.Error(t, config.IsValid())
		})

		t.Run("unset value", func(t *testing.T) {
			config.MoveThreadMaxCount = ""
			require.NoError(t, config.IsValid())
		})
	})
}
