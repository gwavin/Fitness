// An Android browser simulation; does not launch a native app or prove delivery.
async page => {
  const context = await page.context().browser().newContext({ viewport:{width:320,height:740}, userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const p = await context.newPage(); const checks = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  try {
    await p.goto('http://127.0.0.1:8765/Fitness/plans/fitness-v2/index.html');
    await p.waitForFunction(() => document.querySelector('#offline-status').textContent.includes('Offline cache ready'));
    check(await p.locator('#android-clock-start').isVisible(), 'Android browser exposes explicit Clock link');
    await p.locator('#timer-toggle').click();
    await p.evaluate(() => document.querySelector('#android-clock-start').addEventListener('click', e => e.preventDefault()));
    await p.locator('#android-clock-start').click();
    const result = await p.evaluate(() => ({ href:document.querySelector('#android-clock-start').href, timer:JSON.parse(localStorage.getItem('fitness-v2')).timer, message:document.querySelector('#clock-handoff-status').textContent }));
    check(result.href.startsWith('intent://timer?seconds='), 'tap creates bounded native intent link');
    check(result.href.includes('package=ie.gavinhoran.fitnessclockbridge'), 'intent targets only our bridge');
    check(result.href.includes('browser_fallback_url='), 'missing bridge has setup fallback');
    check(result.timer.state === 'paused' && result.timer.endAt === null, 'browser timer paused before handoff');
    check(result.message.includes('attempted') && !result.message.includes('started'), 'no false native success assertion');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Android timer dock fits 320px');
    await p.screenshot({path:'output/playwright/fitness-clock-bridge-android-320.png'});
    await p.locator('#timer-reset').click();
    for (let i = 0; i < 6; i++) await p.locator('#timer-minus').click();
    const before = await p.locator('#android-clock-start').getAttribute('href'); await p.locator('#android-clock-start').click({force:true});
    check(await p.locator('#android-clock-start').getAttribute('href') === before, 'zero duration does not construct another handoff');
    check((await p.locator('#clock-handoff-status').textContent()).includes('15 seconds'), 'invalid duration gives visible guidance');
    await context.setOffline(true); await p.goto('http://127.0.0.1:8765/Fitness/plans/fitness-v2/android-clock.html');
    check(await p.locator('h1').textContent() === 'Let Clock handle the alarm.', 'setup fallback cached offline');
    return {passed:checks.length,checks};
  } finally { await context.close(); }
}
