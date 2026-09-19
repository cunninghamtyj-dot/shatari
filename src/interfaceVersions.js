const fetchVersionNames = async (product) => {
    const response = await fetch(`https://ribbit.everynothing.net/products/${product}/versions`);
    if (!response.ok) {
        return [];
    }

    const lines = (await response.text()).split('\n');
    const cols = lines.shift().split('|').map(name => name.replace(/!.*/, ''));
    const versionIndex = cols.indexOf('VersionsName');
    if (versionIndex < 0) {
        return [];
    }

    const result = new Set();

    lines
        .filter(line => line.indexOf('|') > 0)
        .forEach(line => result.add(line.split('|')[versionIndex]));

    return Array.from(result.values());
}

const fetchInterfaceVersions = async () => {
    const allVersions = new Set();
    const products = ['wow', 'wowt', 'wowxptr', 'wow_beta'];
    for (let product, x = 0; product = products[x]; x++) {
        (await fetchVersionNames(product)).forEach(version => allVersions.add(version));
    }

    const allInterfaces = new Set();
    Array.from(allVersions.values()).forEach(version => {
        allInterfaces.add(version.split('.').slice(0, 3).map(num => '' + (num < 10 ? '0' : '') + num).join(''));
    });

    return Array.from(allInterfaces.values());
};

module.exports = fetchInterfaceVersions;
