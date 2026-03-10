package main

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const helpText = `Wrangler Plugin - Slash Command Help

%s
%s

/wrangler attach message [MESSAGE_ID_TO_ATTACH] [ROOT_MESSAGE_ID]
  Attach a given message to a thread in the same channel
    - Obtain the message IDs by running '/wrangler list messages' or via the 'Permalink' message dropdown option (it's the last part of the URL)
%s
/wrangler list channels [flags]
  List the IDs of all channels you have joined
	Flags:
%s
/wrangler list messages [flags]
  List the IDs of recent messages in this channel
    Flags:
%s
/wrangler info
  Shows plugin information`

func (p *Plugin) getHelp() string {
	var optionalMergeThread string
	if p.getConfiguration().MergeThreadEnable {
		optionalMergeThread = mergeThreadUsage
	}

	return codeBlock(fmt.Sprintf(
		helpText,
		getMoveThreadUsage(),
		copyThreadUsage,
		optionalMergeThread,
		getListChannelsFlagSet().FlagUsages(),
		getListMessagesFlagSet().FlagUsages(),
	))
}

func getCommand(autocomplete, mergedEnabled bool) *model.Command {
	return &model.Command{
		Trigger:          "wrangler",
		DisplayName:      "Wrangler",
		Description:      "Manage Mattermost messages!",
		AutoComplete:     autocomplete,
		AutoCompleteDesc: "Available commands: move thread, copy thread, attach message, list messages, list channels, info",
		AutoCompleteHint: "[command]",
		AutocompleteData: getAutocompleteData(mergedEnabled),
	}
}

func getCommandResponse(responseType, text string) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType: responseType,
		Text:         text,
		Username:     "wrangler",
		IconURL:      fmt.Sprintf("/plugins/%s/profile.png", manifest.Id),
	}
}

// ExecuteCommand executes a given command and returns a command response.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	if !p.authorizedPluginUser(args.UserId) {
		return getCommandResponse(model.CommandResponseTypeEphemeral, "Permission denied. Please talk to your system administrator to get access."), nil
	}

	stringArgs := strings.Split(args.Command, " ")

	if len(stringArgs) < 2 {
		return getCommandResponse(model.CommandResponseTypeEphemeral, p.getHelp()), nil
	}

	command := stringArgs[1]

	var handler func([]string, *model.CommandArgs) (*model.CommandResponse, bool, error)

	switch command {
	case "move":
		if len(stringArgs) < 3 {
			break
		}

		switch stringArgs[2] {
		case "thread":
			handler = p.runMoveThreadCommand
			stringArgs = stringArgs[3:]
		}
	case "copy":
		if len(stringArgs) < 3 {
			break
		}

		switch stringArgs[2] {
		case "thread":
			handler = p.runCopyThreadCommand
			stringArgs = stringArgs[3:]
		}
	case "attach":
		if len(stringArgs) < 3 {
			break
		}

		switch stringArgs[2] {
		case "message":
			handler = p.runAttachMessageCommand
			stringArgs = stringArgs[3:]
		}
	case "merge":
		if len(stringArgs) < 3 {
			break
		}

		switch stringArgs[2] {
		case "thread":
			handler = p.runMergeThreadCommand
			stringArgs = stringArgs[3:]
		}
	case "list":
		if len(stringArgs) < 3 {
			break
		}

		switch stringArgs[2] {
		case "channels":
			handler = p.runListChannelsCommand
			stringArgs = stringArgs[3:]
		case "messages":
			handler = p.runListMessagesCommand
			stringArgs = stringArgs[3:]
		}
	case "info":
		handler = p.runInfoCommand
		stringArgs = stringArgs[2:]
	}

	if handler == nil {
		return getCommandResponse(model.CommandResponseTypeEphemeral, p.getHelp()), nil
	}

	resp, userError, err := handler(stringArgs, args)

	if err != nil {
		p.API.LogError(err.Error())
		if userError {
			return getCommandResponse(model.CommandResponseTypeEphemeral, fmt.Sprintf("__Error: %s__\n\nRun `/wrangler help` for usage instructions.", err.Error())), nil
		}

		return getCommandResponse(model.CommandResponseTypeEphemeral, "An unknown error occurred. Please talk to your administrator for help."), nil
	}

	return resp, nil
}

func (p *Plugin) runInfoCommand(args []string, extra *model.CommandArgs) (*model.CommandResponse, bool, error) {
	resp := fmt.Sprintf("Wrangler plugin version: %s, "+
		"[%s](https://github.com/mattermost/mattermost-plugin-wrangler/commit/%s), built %s\n\n",
		manifest.Version, BuildHashShort, BuildHash, BuildDate)

	return getCommandResponse(model.CommandResponseTypeEphemeral, resp), false, nil
}

func (p *Plugin) authorizedPluginUser(userID string) bool {
	config := p.getConfiguration()

	// There are only three valid values of permitted users. Although getting a
	// value other than these three should never happen, we will be extra
	// cautious and ensure this is the case before proceeding.
	switch config.PermittedWranglerUsers {
	case permittedUserSystemAdmins,
		permittedUserSystemAdminsAndEmail,
		permittedUserAllUsers:
	default:
		p.API.LogWarn(fmt.Sprintf("Permitted plugin user setting %s is invalid", config.PermittedWranglerUsers))
		return false
	}

	user, err := p.API.GetUser(userID)
	if err != nil {
		return false
	}

	// System admins can always use the plugin.
	if user.IsSystemAdmin() {
		return true
	}
	if config.PermittedWranglerUsers == permittedUserSystemAdmins {
		return false
	}

	// A quick check if all users are permitted.
	if config.PermittedWranglerUsers == permittedUserAllUsers {
		return true
	}

	// The only user permission setting left at this point is system admins and
	// the allowed email domain list.
	if len(config.AllowedEmailDomain) != 0 {
		emailDomains := strings.Split(config.AllowedEmailDomain, ",")
		for _, emailDomain := range emailDomains {
			if strings.Contains(emailDomain, "@") {
				if user.Email == emailDomain {
					return true
				}
			} else {
				if strings.HasSuffix(user.Email, "@"+emailDomain) {
					return true
				}
			}
		}

		return false
	}

	return true
}

func getAutocompleteData(mergedEnabled bool) *model.AutocompleteData {
	wrangler := model.NewAutocompleteData("wrangler", "[command]", "Available commands: move, copy, attach, list, info, help")

	move := model.NewAutocompleteData("move", "[subcommand]", "Move messages")
	moveThread := model.NewAutocompleteData("thread", "[MESSAGE_ID or MESSAGE_LINK] [CHANNEL_ID]", "Move a message and the thread it belongs to")
	moveThread.AddTextArgument("The ID of the message or a direct link to the message to be moved", "[MESSAGE_ID or MESSAGE_LINK]", "")
	moveThread.AddTextArgument("The ID of the channel where the message will be moved to", "[CHANNEL_ID]", "")
	move.AddCommand(moveThread)
	wrangler.AddCommand(move)

	copy := model.NewAutocompleteData("copy", "[subcommand]", "Copy messages")
	copyThread := model.NewAutocompleteData("thread", "[MESSAGE_ID or MESSAGE_LINK] [CHANNEL_ID]", "Copy a message and the thread it belongs to")
	copyThread.AddTextArgument("The ID of the message or a direct link to the message to be copied", "[MESSAGE_ID or MESSAGE_LINK]", "")
	copyThread.AddTextArgument("The ID of the channel where the message will be copied to", "[CHANNEL_ID]", "")
	copy.AddCommand(copyThread)
	wrangler.AddCommand(copy)

	attach := model.NewAutocompleteData("attach", "[subcommand]", "Attach messages")
	attachMessage := model.NewAutocompleteData("message", "[MESSAGE_ID_TO_ATTACH or MESSAGE_LINK_TO_ATTACH] [ROOT_MESSAGE_ID or ROOT_MESSAGE_LINK]", "Attach a message to a thread in the channel")
	attachMessage.AddTextArgument("The ID of the message or a direct link to the message to be attached", "[MESSAGE_ID_TO_ATTACH or MESSAGE_LINK_TO_ATTACH]", "")
	attachMessage.AddTextArgument("The root message ID or a direct link to the root message of the thread", "[ROOT_MESSAGE_ID or ROOT_MESSAGE_LINK]", "")
	attach.AddCommand(attachMessage)
	wrangler.AddCommand(attach)

	if mergedEnabled {
		merge := model.NewAutocompleteData("merge", "[subcommand]", "Merge threads")
		mergeThread := model.NewAutocompleteData("thread", "[ROOT_MESSAGE_ID or ROOT_MESSAGE_LINK] [TARGET_ROOT_MESSAGE_ID or TARGET_MESSAGE_LINK]", "Merge a thread's messages into another existing thread")
		mergeThread.AddTextArgument("The root message ID or a direct link to the root message of the thread to be merged", "[ROOT_MESSAGE_ID or ROOT_MESSAGE_LINK]", "")
		mergeThread.AddTextArgument("The root message ID or a direct link to the root message of the thread to merge into", "[TARGET_ROOT_MESSAGE_ID or TARGET_ROOT_MESSAGE_LINK]", "")
		merge.AddCommand(mergeThread)
		wrangler.AddCommand(merge)
	}

	list := model.NewAutocompleteData("list", "[subcommand]", "Lists IDs for channels and messages")
	listChannels := model.NewAutocompleteData("channels", "[optional flags]", "List channel IDs that you have joined")
	listMessages := model.NewAutocompleteData("messages", "[optional flags]", "List message IDs in this channel")
	list.AddCommand(listChannels)
	list.AddCommand(listMessages)
	wrangler.AddCommand(list)

	info := model.NewAutocompleteData("info", "", "Shows plugin information")
	wrangler.AddCommand(info)

	help := model.NewAutocompleteData("help", "", "Shows detailed help information")
	wrangler.AddCommand(help)

	return wrangler
}
