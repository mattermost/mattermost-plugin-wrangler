package main

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestChannelListCommand(t *testing.T) {
	api := &plugintest.API{}
	api.On("GetTeamsForUser", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(mockGenerateTeams(3), nil)
	api.On("GetChannelsForTeamForUser", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(mockGenerateChannels(3), nil)

	var plugin Plugin
	plugin.SetAPI(api)

	t.Run("flags", func(t *testing.T) {
		t.Run("team-filter", func(t *testing.T) {
			t.Run("with results", func(t *testing.T) {
				resp, isUserError, err := plugin.runListChannelsCommand([]string{"--team-filter=team"}, &model.CommandArgs{})
				require.NoError(t, err)
				assert.False(t, isUserError)
				assert.Contains(t, resp.Text, "team-0")
				assert.Contains(t, resp.Text, "team-1")
				assert.Contains(t, resp.Text, "team-2")
				assert.Contains(t, resp.Text, "channel-0")
				assert.Contains(t, resp.Text, "channel-1")
				assert.Contains(t, resp.Text, "channel-2")
			})

			t.Run("no results", func(t *testing.T) {
				resp, isUserError, err := plugin.runListChannelsCommand([]string{"--team-filter=thisteamdoesnotexist"}, &model.CommandArgs{})
				require.NoError(t, err)
				assert.False(t, isUserError)
				assert.Contains(t, resp.Text, "No results found")
			})
		})

		t.Run("channel-filter", func(t *testing.T) {
			t.Run("with results", func(t *testing.T) {
				resp, isUserError, err := plugin.runListChannelsCommand([]string{"--channel-filter=channel"}, &model.CommandArgs{})
				require.NoError(t, err)
				assert.False(t, isUserError)
				assert.Contains(t, resp.Text, "team-0")
				assert.Contains(t, resp.Text, "team-1")
				assert.Contains(t, resp.Text, "team-2")
				assert.Contains(t, resp.Text, "channel-0")
				assert.Contains(t, resp.Text, "channel-1")
				assert.Contains(t, resp.Text, "channel-2")
			})

			t.Run("no results", func(t *testing.T) {
				resp, isUserError, err := plugin.runListChannelsCommand([]string{"--channel-filter=thischanneldoesnotexist"}, &model.CommandArgs{})
				require.NoError(t, err)
				assert.False(t, isUserError)
				assert.Contains(t, resp.Text, "No results found")
			})
		})

		t.Run("team-filter and channel-filter", func(t *testing.T) {
			t.Run("with results", func(t *testing.T) {
				resp, isUserError, err := plugin.runListChannelsCommand([]string{" --team-filter=team --channel-filter=channel"}, &model.CommandArgs{})
				require.NoError(t, err)
				assert.False(t, isUserError)
				assert.Contains(t, resp.Text, "team-0")
				assert.Contains(t, resp.Text, "team-1")
				assert.Contains(t, resp.Text, "team-2")
				assert.Contains(t, resp.Text, "channel-0")
				assert.Contains(t, resp.Text, "channel-1")
				assert.Contains(t, resp.Text, "channel-2")
			})

			t.Run("no results", func(t *testing.T) {
				resp, isUserError, err := plugin.runListChannelsCommand([]string{"--team-filter=thisteamdoesnotexist --channel-filter=thischanneldoesnotexist"}, &model.CommandArgs{})
				require.NoError(t, err)
				assert.False(t, isUserError)
				assert.Contains(t, resp.Text, "No results found")
			})
		})
	})

	t.Run("list channels successfully", func(t *testing.T) {
		resp, isUserError, err := plugin.runListChannelsCommand([]string{}, &model.CommandArgs{})
		require.NoError(t, err)
		assert.False(t, isUserError)
		assert.Contains(t, resp.Text, "team-0")
		assert.Contains(t, resp.Text, "team-1")
		assert.Contains(t, resp.Text, "team-2")
		assert.Contains(t, resp.Text, "channel-0")
		assert.Contains(t, resp.Text, "channel-1")
		assert.Contains(t, resp.Text, "channel-2")
	})
}

func mockGenerateTeams(total int) []*model.Team {
	var teams []*model.Team
	for i := 0; i < total; i++ {
		teams = append(teams, &model.Team{
			Id:   model.NewId(),
			Name: fmt.Sprintf("team-%d", i),
		})
	}

	return teams
}

func mockGenerateChannels(total int) []*model.Channel {
	var channels []*model.Channel
	for i := 0; i < total; i++ {
		channels = append(channels, &model.Channel{
			Id:   model.NewId(),
			Name: fmt.Sprintf("channel-%d", i),
		})
	}

	return channels
}
