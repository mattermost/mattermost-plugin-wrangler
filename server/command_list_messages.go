package main

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/pflag"
)

const (
	flagListMessagesCount = "count"
	minListMessagesCount  = 1
	maxListMessagesCount  = 100

	flagListMessagesTrimLength = "trim-length"
	minListMessagesTrimLength  = 10
	maxListMessagesTrimLength  = 500
)

type listMessagesOptions struct {
	count      int
	trimLength int
}

func getListMessagesFlagSet() *pflag.FlagSet {
	listMessagesFlagSet := pflag.NewFlagSet("list messages", pflag.ContinueOnError)
	listMessagesFlagSet.Int(flagListMessagesCount, 20, fmt.Sprintf("Number of messages to return. Must be between %d and %d", minListMessagesCount, maxListMessagesCount))
	listMessagesFlagSet.Int(flagListMessagesTrimLength, 50, fmt.Sprintf("The max character count of messages listed before they are trimmed. Must be between %d and %d", minListMessagesTrimLength, maxListMessagesTrimLength))

	return listMessagesFlagSet
}

func parseListMessagesArgs(args []string) (listMessagesOptions, error) {
	var options listMessagesOptions

	listMessagesFlagSet := getListMessagesFlagSet()
	err := listMessagesFlagSet.Parse(args)
	if err != nil {
		return options, err
	}

	options.count, err = listMessagesFlagSet.GetInt(flagListMessagesCount)
	if err != nil {
		return options, err
	}
	if options.count < minListMessagesCount || options.count > maxListMessagesCount {
		return options, fmt.Errorf("%s (%d) must be between %d and %d", flagListMessagesCount, options.count, minListMessagesCount, maxListMessagesCount)
	}

	options.trimLength, err = listMessagesFlagSet.GetInt(flagListMessagesTrimLength)
	if err != nil {
		return options, err
	}
	if options.trimLength < minListMessagesTrimLength || options.trimLength > maxListMessagesTrimLength {
		return options, fmt.Errorf("%s (%d) must be between %d and %d", flagListMessagesTrimLength, options.trimLength, minListMessagesTrimLength, maxListMessagesTrimLength)
	}

	return options, nil
}

func (p *Plugin) runListMessagesCommand(args []string, extra *model.CommandArgs) (*model.CommandResponse, bool, error) {
	options, err := parseListMessagesArgs(args)
	if err != nil {
		return nil, true, err
	}

	channelPosts, appErr := p.API.GetPostsForChannel(extra.ChannelId, 0, options.count)
	if appErr != nil {
		return nil, false, appErr
	}

	msg := fmt.Sprintf("The last %d messages in this channel:\n", options.count)
	for _, post := range channelPosts.ToSlice() {
		if post.IsSystemMessage() {
			msg += "[     system message     ] - <skipped>\n"
		} else {
			msg += fmt.Sprintf("%s - %s\n", post.Id, cleanAndTrimMessage(post.Message, options.trimLength))
		}
	}

	msg = codeBlock(strings.TrimRight(msg, "\n"))

	return getCommandResponse(model.CommandResponseTypeEphemeral, msg), false, nil
}
