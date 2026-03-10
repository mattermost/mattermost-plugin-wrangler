package main

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestCommand(t *testing.T) {
	context := &plugin.Context{}

	user := &model.User{
		Id:    model.NewId(),
		Email: "user@emaildomain.com",
	}
	adminUser := &model.User{
		Id:    model.NewId(),
		Email: "admin@admindomain.com",
		Roles: model.SystemAdminRoleId,
	}

	api := &plugintest.API{}
	api.On("GetUser", adminUser.Id).Return(adminUser, nil)
	api.On("GetUser", user.Id).Return(user, nil)
	api.On("GetUser", mock.AnythingOfType("string"), mock.Anything, mock.Anything).Return(nil, &model.AppError{DetailedError: "invalid user"})
	api.On("LogWarn", mock.AnythingOfType("string")).Return(nil)

	var plugin Plugin
	plugin.SetAPI(api)
	plugin.setConfiguration(&configuration{
		PermittedWranglerUsers: permittedUserAllUsers,
	})

	t.Run("args", func(t *testing.T) {
		t.Run("no args", func(t *testing.T) {
			args := &model.CommandArgs{UserId: user.Id}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			require.Equal(t, plugin.getHelp(), resp.Text)
		})

		t.Run("one arg", func(t *testing.T) {
			args := &model.CommandArgs{UserId: user.Id, Command: "one"}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			require.Equal(t, plugin.getHelp(), resp.Text)
		})

		t.Run("two args, invalid command", func(t *testing.T) {
			args := &model.CommandArgs{UserId: user.Id, Command: "one two"}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			require.Equal(t, plugin.getHelp(), resp.Text)
		})

		t.Run("move command", func(t *testing.T) {
			t.Run("missing extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler move"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})

			t.Run("invalid extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler move invalid"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})
		})

		t.Run("copy command", func(t *testing.T) {
			t.Run("missing extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler copy"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})

			t.Run("invalid extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler copy invalid"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})
		})

		t.Run("attach command", func(t *testing.T) {
			t.Run("missing extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler attach"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})

			t.Run("invalid extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler attach invalid"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})
		})

		t.Run("merge command", func(t *testing.T) {
			t.Run("missing extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler merge"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})

			t.Run("invalid extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler merge invalid"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})
		})

		t.Run("list command", func(t *testing.T) {
			t.Run("missing extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler list"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})

			t.Run("invalid extra args", func(t *testing.T) {
				args := &model.CommandArgs{UserId: user.Id, Command: "wrangler list invalid"}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				require.Equal(t, plugin.getHelp(), resp.Text)
			})
		})
	})

	t.Run("info command", func(t *testing.T) {
		args := &model.CommandArgs{UserId: user.Id, Command: "wrangler info"}
		resp, appErr := plugin.ExecuteCommand(context, args)
		require.Nil(t, appErr)
		infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
		require.NoError(t, err)
		assert.False(t, userError)
		assert.Equal(t, infoResp, resp)
	})

	t.Run("permissions", func(t *testing.T) {
		t.Run("empty permission configuration", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				PermittedWranglerUsers: "",
				AllowedEmailDomain:     "emaildomain.com",
			})
			args := &model.CommandArgs{
				UserId:  user.Id,
				Command: "wrangler info",
			}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
		})

		t.Run("invalid permission configuration", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				PermittedWranglerUsers: "invalid",
				AllowedEmailDomain:     "emaildomain.com",
			})
			args := &model.CommandArgs{
				UserId:  user.Id,
				Command: "wrangler info",
			}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
		})

		t.Run("system admins only", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				PermittedWranglerUsers: permittedUserSystemAdmins,
				AllowedEmailDomain:     "emaildomain.com",
			})
			args := &model.CommandArgs{
				UserId:  adminUser.Id,
				Command: "wrangler info",
			}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
			require.NoError(t, err)
			assert.False(t, userError)
			assert.Equal(t, infoResp, resp)
		})

		t.Run("system admins only and not admin", func(t *testing.T) {
			plugin.setConfiguration(&configuration{
				PermittedWranglerUsers: permittedUserSystemAdmins,
				AllowedEmailDomain:     "emaildomain.com",
			})
			args := &model.CommandArgs{
				UserId:  user.Id,
				Command: "wrangler info",
			}
			resp, appErr := plugin.ExecuteCommand(context, args)
			require.Nil(t, appErr)
			assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
		})

		t.Run("allowed email domain", func(t *testing.T) {
			t.Run("enabled, user not in domain", func(t *testing.T) {
				plugin.setConfiguration(&configuration{
					PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
					AllowedEmailDomain:     "baddomain.com",
				})
				args := &model.CommandArgs{
					UserId:  user.Id,
					Command: "wrangler info",
				}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
			})

			t.Run("enabled, user in domain", func(t *testing.T) {
				plugin.setConfiguration(&configuration{
					PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
					AllowedEmailDomain:     "emaildomain.com",
				})
				args := &model.CommandArgs{
					UserId:  user.Id,
					Command: "wrangler info",
				}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
				require.NoError(t, err)
				assert.False(t, userError)
				assert.Equal(t, infoResp, resp)
			})

			t.Run("enabled, invalid user", func(t *testing.T) {
				plugin.setConfiguration(&configuration{
					PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
					AllowedEmailDomain:     "emaildomain.com",
				})
				args := &model.CommandArgs{
					UserId:  model.NewId(),
					Command: "wrangler info",
				}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
			})

			t.Run("enabled, user email domain partial match", func(t *testing.T) {
				plugin.setConfiguration(&configuration{
					PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
					AllowedEmailDomain:     "domain.com",
				})
				args := &model.CommandArgs{
					UserId:  user.Id,
					Command: "wrangler info",
				}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
			})

			t.Run("email domain setting is empty", func(t *testing.T) {
				plugin.setConfiguration(&configuration{
					PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
					AllowedEmailDomain:     "",
				})
				args := &model.CommandArgs{
					UserId:  user.Id,
					Command: "wrangler info",
				}
				resp, appErr := plugin.ExecuteCommand(context, args)
				require.Nil(t, appErr)
				infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
				require.NoError(t, err)
				assert.False(t, userError)
				assert.Equal(t, infoResp, resp)
			})

			t.Run("multiple domains", func(t *testing.T) {
				t.Run("user in first domain", func(t *testing.T) {
					plugin.setConfiguration(&configuration{
						PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
						AllowedEmailDomain:     "emaildomain.com,anotherdomain.com",
					})
					args := &model.CommandArgs{
						UserId:  user.Id,
						Command: "wrangler info",
					}
					resp, appErr := plugin.ExecuteCommand(context, args)
					require.Nil(t, appErr)
					infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
					require.NoError(t, err)
					assert.False(t, userError)
					assert.Equal(t, infoResp, resp)
				})

				t.Run("user in second domain", func(t *testing.T) {
					user.Email = "user@anotherdomain.com"
					plugin.setConfiguration(&configuration{
						PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
						AllowedEmailDomain:     "emaildomain.com,anotherdomain.com",
					})
					args := &model.CommandArgs{
						UserId:  user.Id,
						Command: "wrangler info",
					}
					resp, appErr := plugin.ExecuteCommand(context, args)
					require.Nil(t, appErr)
					infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
					require.NoError(t, err)
					assert.False(t, userError)
					assert.Equal(t, infoResp, resp)
				})

				t.Run("user in neither domain", func(t *testing.T) {
					user.Email = "user@anotherbaddomain.com"
					plugin.setConfiguration(&configuration{
						PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
						AllowedEmailDomain:     "emaildomain.com,anotherdomain.com",
					})
					args := &model.CommandArgs{
						UserId:  user.Id,
						Command: "wrangler info",
					}
					resp, appErr := plugin.ExecuteCommand(context, args)
					require.Nil(t, appErr)
					assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
				})

				t.Run("user is a direct email match", func(t *testing.T) {
					user.Email = "user1@test.com"
					plugin.setConfiguration(&configuration{
						PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
						AllowedEmailDomain:     "emaildomain.com,anotherdomain.com,user1@test.com",
					})
					args := &model.CommandArgs{
						UserId:  user.Id,
						Command: "wrangler info",
					}
					resp, appErr := plugin.ExecuteCommand(context, args)
					require.Nil(t, appErr)
					infoResp, userError, err := plugin.runInfoCommand([]string{}, nil)
					require.NoError(t, err)
					assert.False(t, userError)
					assert.Equal(t, infoResp, resp)
				})

				t.Run("user has email address that has suffix of a full allowed email", func(t *testing.T) {
					user.Email = "1user1@test.com"
					plugin.setConfiguration(&configuration{
						PermittedWranglerUsers: permittedUserSystemAdminsAndEmail,
						AllowedEmailDomain:     "emaildomain.com,anotherdomain.com,user1@test.com",
					})
					args := &model.CommandArgs{
						UserId:  user.Id,
						Command: "wrangler info",
					}
					resp, appErr := plugin.ExecuteCommand(context, args)
					require.Nil(t, appErr)
					assert.Equal(t, "Permission denied. Please talk to your system administrator to get access.", resp.Text)
				})
			})
		})
	})
}
