const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  execFileSync
} = require('node:child_process');
const ts = require('typescript');
const prefix = 'stake-local-mobile/';
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', '6f975e9', prefix + 'src/features'], {
  encoding: 'utf8',
  cwd: '..'
}).trim().split('\n');
function original(path) {
  return execFileSync('git', ['show', '6f975e9:' + path], {
    encoding: 'utf8'
  });
}
function parse(path, text) {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function styles(source) {
  let value;
  function walk(n) {
    if (ts.isCallExpression(n) && n.expression.getText(source) === 'StyleSheet.create') value = n.arguments[0].getText(source);
    ts.forEachChild(n, walk);
  }
  walk(source);
  return value;
}
function depositCopy(source) {
  const text = [];
  function walk(n) {
    if (ts.isJsxText(n) && /good.?faith|deposit|guarantee everyone plays fair/i.test(n.text)) text.push(n.text.replace(/Learn more(?:…\.|\.\.\.)/g, '').trim());
    ts.forEachChild(n, walk);
  }
  walk(source);
  return text;
}
for (const path of paths) test(`original screen styles and deposit explanations preserved: ${path.split('/').pop()}`, () => {
  const before = parse(path, original(path));
  const after = parse(path, fs.readFileSync(path.slice(prefix.length), 'utf8'));
  if (!path.endsWith('/ProfileScreen.tsx')) assert.equal(styles(after), styles(before));
  const current = depositCopy(after);
  for (const copy of depositCopy(before)) assert.ok(current.includes(copy), `Missing original explanation: ${copy}`);
});
for (const name of ['CreateOfferScreen', 'MatchAndRaiseScreen']) test(`original dropdown options preserved: ${name}`, () => {
  const path = prefix + `src/features/offers/screens/${name}.tsx`;
  const old = original(path);
  const current = fs.readFileSync(path.slice(prefix.length), 'utf8');
  for (const identifier of ['ODDS_OPTIONS', 'EXPIRY_OPTIONS']) {
    const get = text => text.match(new RegExp(`const ${identifier}[^=]*= \\[([\\s\\S]*?)\\n\\];`))?.[0];
    assert.equal(get(current)?.replace("label: 'No limit'", "label: 'Forever'"), get(old));
  }
  assert.ok(current.includes("useState<OddsOption | null>(ODDS_OPTIONS[0])"));
  if (name === 'CreateOfferScreen') {
    assert.ok(current.includes('useState(-1)'));
    assert.ok(current.includes('useState(false)'));
  }
});

for (const name of ['CreateOfferScreen', 'MatchAndRaiseScreen']) test(`${name}: custom Apply validates and Cancel preserves the selected amount`, () => {
  const vm = require('node:vm');
  const text = fs.readFileSync(`src/features/offers/screens/${name}.tsx`, 'utf8');
  const source = parse(name, text);
  const handlers = {};
  function walk(node) {
    if (ts.isVariableDeclaration(node) && ['applyCustom','closeOdds'].includes(node.name.getText(source))) handlers[node.name.getText(source)] = node.initializer.getText(source);
    ts.forEachChild(node, walk);
  }
  walk(source);
  for (const value of ['0', '-1', '1.234', 'NaN', '12.50']) {
    const state = {amount: '5', selected: {ratio:'1:1'}, open:true, editing:true, alerts:0};
    const sandbox = {customDraft:value, ODDS_OPTIONS:[{ratio:'CUSTOM'}], Alert:{alert:()=>state.alerts++},
      setCustomStakeB:v=>state.amount=v, setSelectedOdds:v=>state.selected=v,
      setEditingCustom:v=>state.editing=v, setShowOddsDropdown:v=>state.open=v};
    vm.runInNewContext(ts.transpile(`const closeOdds=${handlers.closeOdds}; const applyCustom=${handlers.applyCustom}; applyCustom();`), sandbox);
    if (value === '12.50') {assert.equal(state.amount,value);assert.equal(state.selected.ratio,'CUSTOM');assert.equal(state.open,false);}
    else {assert.equal(state.amount,'5');assert.equal(state.open,true);assert.equal(state.alerts,1);}
    vm.runInNewContext('closeOdds();',sandbox);
    assert.equal(state.open,false);
    assert.equal(state.amount,value==='12.50' ? value : '5');
  }
});

test('all deposit Learn more links target the expanded deposit FAQ', () => {
  for (const path of paths) {
    const text=fs.readFileSync(path.slice(prefix.length),'utf8');
    if (text.includes('Learn more')) assert.match(text,/accessibilityRole="link" onPress=\{\(\) => navigation.navigate\('FAQ', \{ topic: 'deposit' \}\)\}/);
  }
  assert.match(fs.readFileSync('src/features/profile/screens/FAQScreen.tsx','utf8'), /route.params\?\.topic === 'deposit' \? 1 : null/);
});

test('detail preview has reversible controls and guards every self-match entry point', () => {
  const text=fs.readFileSync('src/features/bets/screens/BetDetailsScreen.tsx','utf8');
  assert.match(text,/onPress=\{\(\) => setPublicPreview\(true\)\}/);
  assert.match(text,/onPress=\{\(\) => setPublicPreview\(false\)\}/);
  assert.match(text,/Back to owner view/);
  for (const fn of ['handleMatch','handleMatchForLess','handleMatchAndRaise']) {
    assert.ok(text.includes(`const ${fn} = () => {\n    if (guardSelfMatch()) return;`));
  }
  assert.ok(!text.includes('setIsOwner'));
});

test('Near You filters personal offers on every load and links to the existing My Offers route', () => {
  const text=fs.readFileSync('src/features/bets/screens/NearYouScreen.tsx','utf8');
  const filter=text.match(/const openOffers = allOffers.filter\((.*?)\);/)[1];
  const run=new Function('allOffers','userId',`return allOffers.filter(${filter});`);
  const offers=[{creatorUserId:'a',status:'OPEN'},{creatorUserId:'b',status:'OPEN'},{creatorUserId:'b',status:'SETTLED'}];
  assert.deepEqual(run(offers,'a'),[offers[1]]);assert.deepEqual(run(offers,'b'),[offers[0]]);
  assert.match(text,/navigation.navigate\('MyOffers'\)/);
  const nav=fs.readFileSync('src/app/navigation/AppNavigator.tsx','utf8');
  const route=nav.slice(nav.indexOf('name="MyOffers"')).split('/>')[0];
  assert.ok(!route.includes('headerLeft'));assert.ok(!route.includes("screen: 'Profile'"));
  assert.match(fs.readFileSync('src/features/profile/screens/ProfileScreen.tsx','utf8'),/navigation.navigate\('MyOffers'\)/);
});

test('Profile header and logout belong to the scrolling list; failed images collapse', () => {
  const text=fs.readFileSync('src/features/profile/screens/ProfileScreen.tsx','utf8');
  assert.match(text,/ListFooterComponent=\{<TouchableOpacity style=\{styles.logoutButton\}/);
  assert.match(text,/ListHeaderComponent=\{<>\s*<View style=\{styles.profileHeader\}/);
  assert.match(text,/!failedImages\[item.id\]/);assert.match(text,/onError=\{\(\) => setFailedImages/);
});
