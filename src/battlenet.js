const https = require('https');
const axios = require('axios');
const Constants = require('./constants');

const httpsAgent = new https.Agent({keepAlive: true, maxSockets: 4});

module.exports = function () {
    const self = this;

    // ********************* //
    // ***** CONSTANTS ***** //
    // ********************* //

    this.REGION_US = 'us';
    this.REGION_EU = 'eu';
    this.REGION_TW = 'tw';
    this.REGION_KR = 'kr';
    this.REGION_US_FOREVER = 'usf';
    this.REGION_EU_FOREVER = 'euf';
    this.REGION_TW_FOREVER = 'twf';
    this.REGION_KR_FOREVER = 'krf';

    const MASK_ALLIANCE = 0x8000;
    const MASK_HORDE = 0xc000;
    const MASK_NEUTRAL = 0;

    const HOUSE_ALLIANCE = 2;
    const HOUSE_HORDE = 6;
    const HOUSE_NEUTRAL = 7;

    // ********************* //
    // ***** VARIABLES ***** //
    // ********************* //

    let clientCredentials;

    // ********************* //
    // ***** FUNCTIONS ***** //
    // ********************* //

    // ------ //
    // PUBLIC //
    // ------ //

    /**
     * Make an API call to the given path. Returns the axios response.
     *
     * @param {string} region
     * @param {string} path
     * @param {object} [params]
     * @param {object} [headers]
     * @return {AxiosResponse}
     */
    this.fetch = async function (region, path, params, headers) {
        let token = await getClientCredentials();

        if (path.substr(0, 1) !== '/') {
            path = '/' + path;
        }

        params = params || {};
        params.namespace = params.namespace || ('dynamic-' + getRegionNamespace(region));
        if (params.locale !== null) {
            params.locale = params.locale || 'en_US';
        }

        headers = headers || {};
        const defaultHeaders = {
            accept: 'application/json',
            'accept-encoding': 'gzip',
            authorization: 'Bearer ' + token,
        };
        for (let k in defaultHeaders) {
            if (defaultHeaders.hasOwnProperty(k) && !headers.hasOwnProperty(k)) {
                headers[k] = defaultHeaders[k];
            }
        }

        return axios({
            headers: headers,
            httpsAgent: httpsAgent,
            params: params,
            url: 'https://' + getRegionSubdomain(region) + '.api.blizzard.com' + path,
            validateStatus: (status) => status < 400,
        });
    };

    /**
     * Returns the product constant for the given region.
     *
     * @param {string} region
     * @return {string}
     */
    this.getProduct = region => {
        switch (region) {
            case self.REGION_US:
            case self.REGION_EU:
            case self.REGION_TW:
            case self.REGION_KR:
                return Constants.PRODUCT_MAINLINE;
            case self.REGION_US_FOREVER:
            case self.REGION_EU_FOREVER:
            case self.REGION_TW_FOREVER:
            case self.REGION_KR_FOREVER:
                return Constants.PRODUCT_FOREVER;
        }

        throw `Unknown region: [${region}]`;
    };

    /**
     * Turns "enus" into "en_US"
     *
     * @param {string} locale
     * @return {string}
     */
    this.localeBuild = function (locale) {
        return locale.substr(0, 2) + '_' + locale.substr(2, 2).toUpperCase();
    };

    /**
     * Turns "en_US" into "enus"
     *
     * @param {string} locale
     * @return {string}
     */
    this.localeParse = function (locale) {
        return locale.toLowerCase().replace(/_/g, '').substr(0, 4);
    };

    /**
     * Returns the list of faction masks for this region.
     *
     * @param {string} region
     * @return {{key: string|undefined, mask: number, house: number|undefined}[]}
     */
    this.getFactionMasks = region => {
        switch (self.getProduct(region)) {
            case Constants.PRODUCT_MAINLINE:
                return [{key: undefined, mask: 0, house: undefined}];
            case Constants.PRODUCT_FOREVER:
                return [
                    {key: 'alliance', mask: MASK_ALLIANCE, house: HOUSE_ALLIANCE},
                    {key: 'horde', mask: MASK_HORDE, house: HOUSE_HORDE},
                    {key: 'neutral', mask: MASK_NEUTRAL, house: HOUSE_NEUTRAL},
                ];
        }

        throw `Unsupported region: [${region}]`;
    };

    /**
     * Returns whether this region has faction-split auction houses per realm.
     *
     * @param {string} region
     * @return {boolean}
     */
    this.hasFactionHouses = region => self.getFactionMasks(region).length > 1;

    /**
     * Processes a realm ID to pull out the faction name and house ID. The realm is assumed to be in a faction-houses
     * region.
     *
     * @param {string} region
     * @param {number} realm
     * @return {{realm: number, faction: string|undefined, house: number|undefined}}
     */
    this.stripFactionMask = (region, realm) => self.getFactionMasks(region)
        .filter(mask => (realm & ~Constants.REALM_ID_MASK) === mask.mask)
        .map(mask => ({
            realm: realm & Constants.REALM_ID_MASK,
            faction: mask.key,
            house: mask.house,
        }))[0] ?? {realm};

    // ------- //
    // PRIVATE //
    // ------- //

    /**
     * Returns the client credentials token.
     *
     * @return {string}
     */
    async function getClientCredentials() {
        if (clientCredentials && clientCredentials.expires > Date.now()) {
            return clientCredentials.token;
        }

        const response = await axios({
            auth: {
                username: process.env.BATTLE_NET_KEY,
                password: process.env.BATTLE_NET_SECRET,
            },
            data: 'grant_type=client_credentials',
            headers: {
                accept: 'application/json',
            },
            method: 'POST',
            url: 'https://us.battle.net/oauth/token',
        });

        clientCredentials = {
            expires: Date.now() + response.data.expires_in * 1000,
            token: response.data.access_token,
        };

        return clientCredentials.token;
    }

    /**
     * Returns the region suffix for the api namespace for the given region.
     *
     * @param {string} region
     * @return {string}
     */
    const getRegionNamespace = region => {
        switch (self.getProduct(region)) {
            case Constants.PRODUCT_MAINLINE:
                return region;
            //case Constants.PRODUCT_FOREVER:
            //    return 'classicann-' + region.substring(0, 2); // TODO: using classic anniversary for now
        }

        throw `Unsupported region: [${region}]`;
    };

    /**
     * Returns the api subdomain for the given region.
     *
     * @param {string} region
     * @return {string}
     */
    const getRegionSubdomain = region => {
        switch (self.getProduct(region)) {
            case Constants.PRODUCT_MAINLINE:
                return region;
            case Constants.PRODUCT_FOREVER:
                return region.substring(0, 2);
        }

        throw `Unsupported region: [${region}]`;
    };
};
