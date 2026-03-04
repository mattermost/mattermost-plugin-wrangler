import {Post} from '@mattermost/types/posts';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';

export type RichPost = {
    post: Post;
    user: UserProfile;
    channel: Channel;
}
