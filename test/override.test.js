const assert = require('assert');

function loadOverrideModule(args) {
  const modulePath = require.resolve('../override.js');
  delete require.cache[modulePath];
  if (args) {
    global.$arguments = args;
  }
  const mod = require('../override.js');
  if (args) {
    delete global.$arguments;
  }
  return mod;
}

function testHasLowCostDetection() {
  const { hasLowCost } = loadOverrideModule();
  assert.strictEqual(
    hasLowCost({ proxies: [{ name: '普通节点' }] }),
    false,
    'Regular nodes should not be detected as low cost'
  );

  assert.strictEqual(
    hasLowCost({ proxies: [{ name: '0.4 倍率节点' }] }),
    true,
    'Nodes that match the low-cost pattern should be detected'
  );
}

function testDnsSelectionByFakeIpFlag() {
  const { main } = loadOverrideModule();
  const fakeIpConfig = main({ proxies: [] }, { fakeIP: true });
  assert.strictEqual(
    fakeIpConfig.dns['enhanced-mode'],
    'fake-ip',
    'Fake IP flag should switch to the fake-ip DNS mode'
  );

  const redirHostConfig = main({ proxies: [] }, { fakeIP: false });
  assert.strictEqual(
    redirHostConfig.dns['enhanced-mode'],
    'redir-host',
    'Without the flag the DNS mode should remain redir-host'
  );
}

function testRuleMergingAvoidsDuplicates() {
  const { main, rules } = loadOverrideModule();
  const duplicateRule = 'MATCH,选择节点';
  const configWithDuplicate = { proxies: [], rules: [duplicateRule] };
  const result = main(configWithDuplicate);

  const occurrences = result.rules.filter(rule => rule === duplicateRule).length;
  assert.strictEqual(
    occurrences,
    1,
    'Duplicate rules should be removed when merging'
  );

  assert.ok(
    rules.every(rule => result.rules.includes(rule)),
    'All base rules should be preserved in the merged result'
  );
}

function testLowCostGroupAddedWhenAvailable() {
  const { main } = loadOverrideModule();
  const config = { proxies: [{ name: '0.3 低倍率节点' }] };
  const result = main(config);

  assert.ok(
    result['proxy-groups'].some(group => group.name === '低倍率节点'),
    'Low cost proxy group should be added when low cost proxies exist'
  );
}

function testEmbyGroupAllowsAllProxies() {
  const { main } = loadOverrideModule();
  const config = {
    proxies: [
      { name: '香港节点 01' },
      { name: '家宽-广州' }
    ]
  };
  const result = main(config);

  const embyGroup = result['proxy-groups'].find(group => group.name === 'Emby');
  assert.ok(embyGroup, 'Emby group should exist');
  assert.strictEqual(embyGroup['include-all'], true, 'Emby group should include all proxies');
  assert.ok(!('filter' in embyGroup), 'Emby group should not limit proxies with a filter');
}

function testLandingGroupAllowsAllProxies() {
  const { main } = loadOverrideModule({ landing: 'true' });
  const config = {
    proxies: [
      { name: '家庭宽带·深圳' },
      { name: '东京节点' }
    ]
  };
  const result = main(config);

  const landingGroup = result['proxy-groups'].find(group => group.name === '落地节点');
  assert.ok(landingGroup, 'Landing proxy group should exist when landing mode is enabled');
  assert.strictEqual(landingGroup['include-all'], true, 'Landing group should include all proxies');
  assert.ok(!('filter' in landingGroup), 'Landing group should not restrict selection with a filter');
}

const tests = [
  ['hasLowCost detects low cost proxies', testHasLowCostDetection],
  ['main selects DNS based on fake IP flag', testDnsSelectionByFakeIpFlag],
  ['main merges rules without duplicates', testRuleMergingAvoidsDuplicates],
  ['main adds low cost proxy group when needed', testLowCostGroupAddedWhenAvailable],
  ['main builds Emby group without filters to allow all proxies', testEmbyGroupAllowsAllProxies],
  ['main builds landing group without filters when enabled', testLandingGroupAllowsAllProxies]
];

let passed = 0;
for (const [name, fn] of tests) {
  fn();
  console.log(`✔ ${name}`);
  passed += 1;
}

console.log(`\n${passed} test${passed === 1 ? '' : 's'} passed.`);
