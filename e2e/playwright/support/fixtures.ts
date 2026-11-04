// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {loginAs} from './admin';
import {CHANNELS, DOMAIN, PASSWORD, TEAM_A, TEAM_B, USERNAMES} from './constants';

async function ensureTeam(admin: Client4, name: string): Promise<Team> {
    try {
        return await admin.getTeamByName(name);
    } catch {
        return admin.createTeam({name, display_name: name, type: 'O'} as Parameters<Client4['createTeam']>[0]);
    }
}

async function ensureChannel(admin: Client4, team: Team, name: string, type: 'O' | 'P'): Promise<Channel> {
    try {
        return await admin.getChannelByName(team.id, name);
    } catch {
        return admin.createChannel({team_id: team.id, name, display_name: name, type} as Channel);
    }
}

async function ensureUser(admin: Client4, username: string, email: string): Promise<UserProfile> {
    try {
        return await admin.getUserByUsername(username);
    } catch {
        return admin.createUser({username, email, password: PASSWORD} as UserProfile & {password: string}, '', '');
    }
}

export type Fixtures = {
    teamA: Team;
    teamB: Team;
    source: Channel;
    target: Channel;
    teamBChannel: Channel;
    privateChannel: Channel;
    restrictedChannel: Channel;
    users: {regular: UserProfile; domain: UserProfile; other: UserProfile};
};

// ensureFixtures idempotently seeds teams, channels, and users shared by the specs.
export async function ensureFixtures(admin: Client4): Promise<Fixtures> {
    const teamA = await ensureTeam(admin, TEAM_A);
    const teamB = await ensureTeam(admin, TEAM_B);

    const users = {
        regular: await ensureUser(admin, USERNAMES.regular, `${USERNAMES.regular}@example.com`),
        domain: await ensureUser(admin, USERNAMES.domain, `${USERNAMES.domain}@${DOMAIN}`),
        other: await ensureUser(admin, USERNAMES.other, `${USERNAMES.other}@example.com`),
    };

    for (const user of Object.values(users)) {
        for (const team of [teamA, teamB]) {
            // eslint-disable-next-line no-await-in-loop
            await admin.addToTeam(team.id, user.id).catch(() => undefined);
        }
    }

    const source = await ensureChannel(admin, teamA, CHANNELS.source, 'O');
    const target = await ensureChannel(admin, teamA, CHANNELS.target, 'O');
    const teamBChannel = await ensureChannel(admin, teamB, CHANNELS.teamB, 'O');
    const privateChannel = await ensureChannel(admin, teamA, CHANNELS.private, 'P');

    // Private channel only the admin belongs to; left out of the membership loop below.
    const restrictedChannel = await ensureChannel(admin, teamA, CHANNELS.restricted, 'P');

    const adminProfile = await admin.getMe();
    for (const channel of [source, target, teamBChannel, privateChannel]) {
        for (const user of [adminProfile, ...Object.values(users)]) {
            // eslint-disable-next-line no-await-in-loop
            await admin.addToChannel(user.id, channel.id).catch(() => undefined);
        }
    }

    return {teamA, teamB, source, target, teamBChannel, privateChannel, restrictedChannel, users};
}

export function loginFixtureUser(username: string) {
    return loginAs(username, PASSWORD);
}
