export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scoring-rulesets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RulesetDetailDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/score": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ScoreRoundResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/scores": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ScoresResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/seasons/{seasonId}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    seasonId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeasonLeaderboardResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundLeaderboardResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GlobalStats"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundStatsResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundStatsError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    returnUrl?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthMeResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/dev-login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    subject?: string;
                    name?: string;
                    email?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevLoginResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/championships": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChampionshipDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateChampionship"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChampionshipDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/championships/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChampionshipDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateChampionship"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChampionshipDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/seasons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    championshipId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeasonDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateSeason"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeasonDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/seasons/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeasonDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateSeason"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeasonDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/classes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    championshipId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClassDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateClass"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClassDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/classes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClassDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateClass"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClassDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateEvent"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateEvent"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    seasonId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRound"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateRound"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoundDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{id}/roster-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterRulesResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    roundId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateSession"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateSession"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/drivers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    search?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DriverDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateDriver"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DriverDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/drivers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateDriver"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DriverDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/car-entries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    seasonId?: number;
                    classId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CarEntryDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateCarEntry"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CarEntryDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/car-entries/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateCarEntry"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CarEntryDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/entry-drivers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    carEntryId?: number;
                    driverId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntryDriverDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateEntryDriver"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntryDriverDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/entry-drivers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/seasons/{seasonId}/entry-list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    seasonId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["EntryListImport"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/roster-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    seasonId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterRuleDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRosterRule"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterRuleDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/roster-rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterRuleDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateRosterRule"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterRuleDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/roster-modifier-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    seasonId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterModifierRuleDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRosterModifierRule"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterModifierRuleDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/roster-modifier-rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterModifierRuleDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateRosterModifierRule"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterModifierRuleDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    seasonId?: number;
                    userId?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RegistrationDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRegistration"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RegistrationDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/registrations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RegistrationDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PriceItem"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PriceUpsertRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PriceUpsertResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/registrations/{registrationId}/rounds/{roundId}/roster": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    registrationId: number;
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterResponse"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    registrationId: number;
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PutRosterRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterErrorResponse"];
                    };
                };
                /** @description Unprocessable Entity */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RosterErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/registrations/{registrationId}/rounds/{roundId}/picks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    registrationId: number;
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlayerPicksResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlayerPicksError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/qualifying-results/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    commit?: boolean;
                };
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/octet-stream": components["schemas"]["Stream"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["IngestResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/race-results/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    commit?: boolean;
                };
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/octet-stream": components["schemas"]["Stream"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["IngestResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/race-fastest-laps/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    commit?: boolean;
                };
                header?: never;
                path: {
                    roundId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/octet-stream": components["schemas"]["Stream"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/seasons/{seasonId}/scoring-rulesets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    source?: components["schemas"]["ScoringSource"];
                };
                header?: never;
                path: {
                    seasonId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RulesetDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    seasonId: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRuleset"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RulesetDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/leagues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    seasonId?: number;
                    mine?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LeagueDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateLeague"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LeagueDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/leagues/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LeagueDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/leagues/join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    joinCode?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JoinByCodeResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/leagues/{id}/join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    joinCode?: string;
                };
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JoinLeagueResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/leagues/{id}/leave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/leagues/{id}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    roundId?: number;
                };
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LeagueLeaderboardResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/images/liveries/{roundId}/{entryId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    roundId: number;
                    entryId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImagePresignResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/images/drivers/{driverId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    driverId: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImagePresignResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AuthMeRegistration: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            teamName: string;
        };
        AuthMeResponse: {
            /** Format: int64 */
            userId: number;
            provider: string;
            name: null | string;
            email: null | string;
            isAdmin: boolean;
            registrations: components["schemas"]["AuthMeRegistration"][];
        };
        CarEntryDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            /** Format: int64 */
            classId: number;
            number: string;
            teamName: string;
        };
        ChampionshipDto: {
            /** Format: int64 */
            id: number;
            name: string;
            slug: string;
            /** Format: int32 */
            order: number;
        };
        ClassDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            championshipId: number;
            name: string;
            color: null | string;
            /** Format: int32 */
            sortOrder: number;
        };
        CompositionViolation: {
            class: null | string;
            /** Format: int64 */
            classId: null | number;
            slot: string;
            /** Format: int32 */
            have: number;
            /** Format: int32 */
            min: number;
            /** Format: int32 */
            max: number;
        };
        CreateCarEntry: {
            /** Format: int64 */
            seasonId: number;
            /** Format: int64 */
            classId: number;
            number: string;
            teamName: string;
        };
        CreateChampionship: {
            name: string;
            slug: string;
            /** Format: int32 */
            order: number;
        };
        CreateClass: {
            /** Format: int64 */
            championshipId: number;
            name: string;
            color: null | string;
            /**
             * Format: int32
             * @default 0
             */
            sortOrder: number;
        };
        CreateDriver: {
            fullName: string;
            country: null | string;
        };
        CreateEntryDriver: {
            /** Format: int64 */
            carEntryId: number;
            /** Format: int64 */
            driverId: number;
        };
        CreateEvent: {
            name: string;
            circuit: null | string;
            /** Format: date-time */
            startsAt: null | string;
            /** Format: date-time */
            endsAt: null | string;
            /** @default false */
            picksOpen: boolean;
        };
        CreateLeague: {
            /** Format: int64 */
            seasonId: number;
            name: string;
            visibility: components["schemas"]["LeagueVisibility"];
        };
        CreateRegistration: {
            /** Format: int64 */
            seasonId: number;
            teamName: string;
        };
        CreateRosterModifierRule: {
            /** Format: int64 */
            seasonId: number;
            kind: string;
            /** Format: int32 */
            maxCount: number;
            appliesTo: string;
        };
        CreateRosterRule: {
            /** Format: int64 */
            seasonId: number;
            /** Format: int64 */
            roundId: null | number;
            /** Format: int64 */
            classId: null | number;
            slotType: components["schemas"]["SlotType"];
            /** Format: int32 */
            minPicks: number;
            /** Format: int32 */
            maxPicks: number;
        };
        CreateRound: {
            /** Format: int64 */
            seasonId: number;
            name: string;
            circuit: null | string;
            /** Format: int32 */
            sequence: number;
            /** Format: date-time */
            qualiStart: string;
            /** Format: date-time */
            startsAt: null | string;
            /** Format: date-time */
            endsAt: null | string;
            /** Format: double */
            salaryCap: number;
            /** Format: int64 */
            eventId: null | number;
        };
        CreateRuleset: {
            source: components["schemas"]["ScoringSource"];
            positionPoints: components["schemas"]["RankPoints"][];
            activate: null | boolean;
        };
        CreateSeason: {
            /** Format: int64 */
            championshipId: number;
            /** Format: int32 */
            year: number;
        };
        CreateSession: {
            /** Format: int64 */
            roundId: number;
            /** Format: int64 */
            classId: number;
            type: components["schemas"]["SessionType"];
            /** Format: date-time */
            scheduledStart: null | string;
            status: null | components["schemas"]["SessionStatus"];
        };
        DevLoginResponse: {
            /** Format: int64 */
            userId: number;
        };
        DriverDto: {
            /** Format: int64 */
            id: number;
            fullName: string;
            country: null | string;
        };
        DriverLite: {
            /** Format: int64 */
            id: number;
            fullName: string;
        };
        EntityRef: {
            entityType: string;
            /** Format: int64 */
            entityId: number;
        };
        EntityStat: {
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
            /** Format: int64 */
            classId: number;
            displayName: null | string;
            /** Format: int32 */
            pickCount: number;
            /** Format: double */
            pickPct: number;
            /** Format: double */
            points: null | number;
            /** Format: double */
            price: null | number;
        };
        /** @enum {unknown} */
        EntityType: "Car" | "Driver";
        EntryDriverDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            carEntryId: number;
            /** Format: int64 */
            driverId: number;
            /** Format: int64 */
            seasonId: number;
        };
        EntryListDriver: {
            /** Format: int64 */
            driverId: null | number;
            fullName: null | string;
            country: null | string;
        };
        EntryListEntry: {
            /** Format: int64 */
            classId: null | number;
            className: null | string;
            number: null | string;
            teamName: null | string;
            drivers: null | components["schemas"]["EntryListDriver"][];
        };
        EntryListImport: {
            entries: components["schemas"]["EntryListEntry"][];
        };
        EventDto: {
            /** Format: int64 */
            id: number;
            name: string;
            circuit: null | string;
            /** Format: date-time */
            startsAt: null | string;
            /** Format: date-time */
            endsAt: null | string;
            picksOpen: boolean;
            rounds: components["schemas"]["EventRoundDto"][];
        };
        EventRoundDto: {
            /** Format: int64 */
            roundId: number;
            /** Format: int64 */
            seasonId: number;
            /** Format: int64 */
            championshipId: number;
            championshipName: string;
            /** Format: int32 */
            championshipOrder: number;
            /** Format: int32 */
            year: number;
            roundName: string;
            /** Format: date-time */
            qualiStart: string;
        };
        GlobalStats: {
            /** Format: int32 */
            players: number;
            /** Format: int32 */
            leagues: number;
        };
        ImagePresignResponse: {
            key: string;
            uploadUrl: string;
        };
        IngestClassCount: {
            class: string;
            /** Format: int32 */
            count: number;
        };
        IngestIssue: {
            number: string;
            class: string;
            reason: string;
        };
        IngestResponse: {
            /** Format: int64 */
            roundId: number;
            committed: boolean;
            /** Format: int32 */
            parsed: number;
            /** Format: int32 */
            matched: number;
            /** Format: int32 */
            unmatched: number;
            byClass: components["schemas"]["IngestClassCount"][];
            results: components["schemas"]["IngestResultRow"][];
            /** Format: int32 */
            inserted: null | number;
            /** Format: int32 */
            updated: null | number;
            /** Format: int32 */
            skipped: null | number;
            issues: components["schemas"]["IngestIssue"][];
        };
        IngestResultRow: {
            className: string;
            number: string;
            /** Format: int32 */
            position: number;
            /** Format: int64 */
            lapMs: null | number;
            status: null | string;
            /** Format: int32 */
            laps: null | number;
        };
        JoinByCodeResponse: {
            joined: boolean;
            /** Format: int64 */
            leagueId: number;
        };
        JoinLeagueResponse: {
            joined: boolean;
        };
        JsonElement: unknown;
        LeaderboardEntry: {
            /** Format: int32 */
            rank: number;
            /** Format: int64 */
            registrationId: number;
            teamName: string;
            /** Format: double */
            points: number;
            /** Format: int32 */
            roundsScored: number;
            name?: null | string;
            /** Format: int32 */
            movement?: null | number;
        };
        LeagueDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            name: string;
            visibility: components["schemas"]["LeagueVisibility"];
            /** Format: int64 */
            ownerRegistrationId: number;
            /** Format: int32 */
            memberCount: number;
            isMember: boolean;
            joinCode: null | string;
        };
        LeagueLeaderboardResponse: {
            /** Format: int64 */
            leagueId: number;
            name: string;
            entries: components["schemas"]["LeaderboardEntry"][];
        };
        /** @enum {unknown} */
        LeagueVisibility: "Public" | "Private";
        ModifierInput: {
            kind: string;
            target: null | components["schemas"]["RosterPickInput"];
            params: null | components["schemas"]["JsonElement"];
        };
        ModifierScoreDto: {
            /** Format: int64 */
            modifierId: number;
            kind: string;
            target: null | components["schemas"]["EntityRef"];
            scores: components["schemas"]["SourceScoreDto"][];
        };
        ModifierStat: {
            kind: string;
            /** Format: int32 */
            usageCount: number;
            /** Format: double */
            usagePct: number;
            topTargetEntityType: null | components["schemas"]["EntityType"];
            /** Format: int64 */
            topTargetEntityId: null | number;
            topTargetName: null | string;
            /** Format: double */
            avgBonus: null | number;
        };
        ModifierViolation: {
            kind: string;
            reason: string;
        };
        PickScoreDto: {
            /** Format: int64 */
            pickId: number;
            slotType: components["schemas"]["SlotType"];
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
            /** Format: int64 */
            classId: number;
            scores: components["schemas"]["SourceScoreDto"][];
        };
        PlayerModifierDto: {
            kind: string;
            target: null | components["schemas"]["EntityRef"];
            /** Format: double */
            points: number;
        };
        PlayerPickDto: {
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
            /** Format: int64 */
            classId: number;
            /** Format: double */
            price: number;
            /** Format: double */
            points: number;
            scores: components["schemas"]["SourceScoreDto"][];
        };
        PlayerPicksError: {
            error: string;
            message?: null | string;
        };
        PlayerPicksResponse: {
            /** Format: int64 */
            registrationId: number;
            teamName: string;
            /** Format: int64 */
            roundId: number;
            locked: boolean;
            /** Format: double */
            total: number;
            main: components["schemas"]["PlayerPickDto"][];
            modifiers: components["schemas"]["PlayerModifierDto"][];
        };
        PriceInput: {
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
            /** Format: int64 */
            classId: number;
            /** Format: double */
            price: number;
        };
        PriceItem: {
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
            /** Format: int64 */
            classId: number;
            /** Format: double */
            price: number;
            displayName: null | string;
            drivers?: null | components["schemas"]["DriverLite"][];
            number?: null | string;
        };
        PriceUpsertRequest: {
            prices: components["schemas"]["PriceInput"][];
        };
        PriceUpsertResponse: {
            /** Format: int64 */
            roundId: number;
            /** Format: int32 */
            created: number;
            /** Format: int32 */
            updated: number;
        };
        PutRosterRequest: {
            main: null | components["schemas"]["RosterPickInput"][];
            modifiers: null | components["schemas"]["ModifierInput"][];
        };
        RankPoints: {
            /** Format: int32 */
            rank: number;
            /** Format: double */
            points: number;
        };
        RegistrationDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            userId: null | number;
            /** Format: int64 */
            seasonId: number;
            teamName: string;
        };
        RegistrationScoreDto: {
            /** Format: int64 */
            registrationId: number;
            /** Format: double */
            total: number;
            picks: components["schemas"]["PickScoreDto"][];
            modifiers: components["schemas"]["ModifierScoreDto"][];
        };
        RegistrationTotal: {
            /** Format: int64 */
            registrationId: number;
            /** Format: double */
            points: number;
        };
        RosterErrorResponse: {
            error: string;
            message?: null | string;
            /** Format: double */
            spent?: null | number;
            /** Format: double */
            salaryCap?: null | number;
            entities?: null | components["schemas"]["EntityRef"][];
            violations?: null | components["schemas"]["CompositionViolation"][];
            modifierViolations?: null | components["schemas"]["ModifierViolation"][];
        };
        RosterModifierDto: {
            kind: string;
            target: null | components["schemas"]["EntityRef"];
        };
        RosterModifierRuleDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            kind: string;
            /** Format: int32 */
            maxCount: number;
            appliesTo: string;
        };
        RosterPickDto: {
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
            /** Format: int64 */
            classId: number;
            /** Format: double */
            price: number;
        };
        RosterPickInput: {
            entityType: components["schemas"]["EntityType"];
            /** Format: int64 */
            entityId: number;
        };
        RosterResponse: {
            /** Format: int64 */
            registrationId: number;
            /** Format: int64 */
            roundId: number;
            locked: boolean;
            /** Format: date-time */
            lockedAt: null | string;
            picksOpen: boolean;
            /** Format: double */
            salaryCap: number;
            /** Format: double */
            spent: number;
            /** Format: double */
            remaining: number;
            main: components["schemas"]["RosterPickDto"][];
            modifiers: components["schemas"]["RosterModifierDto"][];
        };
        RosterRuleClass: {
            /** Format: int64 */
            classId: number;
            name: null | string;
            color: null | string;
            slot: string;
            /** Format: int32 */
            min: number;
            /** Format: int32 */
            max: number;
        };
        RosterRuleDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            /** Format: int64 */
            roundId: null | number;
            /** Format: int64 */
            classId: null | number;
            slotType: components["schemas"]["SlotType"];
            /** Format: int32 */
            minPicks: number;
            /** Format: int32 */
            maxPicks: number;
        };
        RosterRuleModifier: {
            kind: string;
            /** Format: int32 */
            maxCount: number;
            appliesTo: string;
        };
        RosterRulesResponse: {
            /** Format: int64 */
            roundId: number;
            /** Format: double */
            salaryCap: number;
            classes: components["schemas"]["RosterRuleClass"][];
            modifiers: components["schemas"]["RosterRuleModifier"][];
        };
        RoundDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            name: string;
            circuit: null | string;
            /** Format: int32 */
            sequence: number;
            /** Format: date-time */
            qualiStart: string;
            /** Format: date-time */
            startsAt: null | string;
            /** Format: date-time */
            endsAt: null | string;
            /** Format: double */
            salaryCap: number;
            /** Format: int64 */
            eventId: null | number;
        };
        RoundLeaderboardResponse: {
            /** Format: int64 */
            roundId: number;
            entries: components["schemas"]["LeaderboardEntry"][];
        };
        RoundStatsError: {
            error: string;
            message: string;
        };
        RoundStatsResponse: {
            /** Format: int64 */
            roundId: number;
            /** Format: int32 */
            rosters: number;
            /** Format: double */
            highScore: null | number;
            /** Format: double */
            avgScore: null | number;
            entities: components["schemas"]["EntityStat"][];
            modifiers: components["schemas"]["ModifierStat"][];
        };
        RulesetDetailDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            source: components["schemas"]["ScoringSource"];
            /** Format: int32 */
            version: number;
            status: components["schemas"]["RulesetStatus"];
            /** Format: date-time */
            effectiveFrom: string;
            positionPoints: components["schemas"]["RankPoints"][];
        };
        RulesetDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            seasonId: number;
            source: components["schemas"]["ScoringSource"];
            /** Format: int32 */
            version: number;
            status: components["schemas"]["RulesetStatus"];
            /** Format: date-time */
            effectiveFrom: string;
        };
        /** @enum {unknown} */
        RulesetStatus: "Draft" | "Active" | "Archived";
        ScoreRoundResult: {
            /** Format: int64 */
            roundId: number;
            activeSources: string[];
            /** Format: int32 */
            scoresInserted: number;
            /** Format: int32 */
            scoresUpdated: number;
            totals: components["schemas"]["RegistrationTotal"][];
        };
        ScoresResponse: {
            /** Format: int64 */
            roundId: number;
            registrations: components["schemas"]["RegistrationScoreDto"][];
        };
        /** @enum {unknown} */
        ScoringSource: "QualifyingPosition" | "RacePosition" | "RaceFastestLap" | "Bonus";
        SeasonDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            championshipId: number;
            /** Format: int32 */
            year: number;
        };
        SeasonLeaderboardResponse: {
            /** Format: int64 */
            seasonId: number;
            entries: components["schemas"]["LeaderboardEntry"][];
        };
        SessionDto: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            roundId: number;
            /** Format: int64 */
            classId: number;
            type: components["schemas"]["SessionType"];
            /** Format: date-time */
            scheduledStart: null | string;
            /** Format: date-time */
            actualStart: null | string;
            status: components["schemas"]["SessionStatus"];
        };
        /** @enum {unknown} */
        SessionStatus: "Scheduled" | "Live" | "Complete" | "Published";
        /** @enum {unknown} */
        SessionType: "Qualifying" | "Race";
        /** @enum {unknown} */
        SlotType: "Main" | "Impact";
        SourceScoreDto: {
            source: components["schemas"]["ScoringSource"];
            /** Format: double */
            points: number;
            /** Format: int32 */
            ruleVersion: number;
        };
        /** Format: binary */
        Stream: string;
        UpdateCarEntry: {
            number: string;
            teamName: string;
        };
        UpdateChampionship: {
            name: string;
            slug: string;
            /** Format: int32 */
            order: number;
        };
        UpdateClass: {
            name: string;
            color: null | string;
            /**
             * Format: int32
             * @default 0
             */
            sortOrder: number;
        };
        UpdateDriver: {
            fullName: string;
            country: null | string;
        };
        UpdateEvent: {
            name: string;
            circuit: null | string;
            /** Format: date-time */
            startsAt: null | string;
            /** Format: date-time */
            endsAt: null | string;
            /** @default false */
            picksOpen: boolean;
        };
        UpdateRosterModifierRule: {
            /** Format: int32 */
            maxCount: number;
            appliesTo: string;
        };
        UpdateRosterRule: {
            /** Format: int32 */
            minPicks: number;
            /** Format: int32 */
            maxPicks: number;
        };
        UpdateRound: {
            name: string;
            circuit: null | string;
            /** Format: int32 */
            sequence: number;
            /** Format: date-time */
            qualiStart: string;
            /** Format: date-time */
            startsAt: null | string;
            /** Format: date-time */
            endsAt: null | string;
            /** Format: double */
            salaryCap: number;
            /** Format: int64 */
            eventId: null | number;
        };
        UpdateSeason: {
            /** Format: int32 */
            year: number;
        };
        UpdateSession: {
            type: components["schemas"]["SessionType"];
            /** Format: date-time */
            scheduledStart: null | string;
            /** Format: date-time */
            actualStart: null | string;
            status: components["schemas"]["SessionStatus"];
        };
        UserDto: {
            /** Format: int64 */
            id: number;
            externalProvider: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: int32 */
            registrationCount: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
