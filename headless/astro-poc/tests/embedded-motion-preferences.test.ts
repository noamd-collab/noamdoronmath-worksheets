import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { runInNewContext } from 'node:vm';

const films = [
  'algebraic-substitution-grade-7',
  'common-factor-minus-parentheses-grade-9',
  'parallel-cointerior-angles',
];
function functionSource(source: string, name: string) {
  const start = source.indexOf(`function ${name}()`);
  assert.ok(start >= 0);
  const brace = source.indexOf('{', start);
  let depth = 1, end = brace + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}
function html() {
  const classes = new Set<string>();
  return { classes, dataset: {} as Record<string,string>, classList: { contains: (name:string) => classes.has(name) } };
}

for (const film of films) {
  it(`${film}: inherited site choice overrides OS reduce, but either document's stop wins`, () => {
    const source=readFileSync(new URL(`../public/loops/${film}.html`,import.meta.url),'utf8');
    const own=html(), parent=html();
    const window={parent:{document:{documentElement:parent}}};
    const off=runInNewContext(`${functionSource(source,'motionOff')}; motionOff`, {
      window,document:{documentElement:own},reducedMotion:{matches:true},
    });
    assert.equal(off(),true);
    parent.classes.add('nd-motion-enabled');
    assert.equal(off(),false,'same-origin parent opt-in reaches the embedded player');
    own.classes.add('nd-motion-off');
    assert.equal(off(),true);
    own.classes.delete('nd-motion-off');
    parent.classes.add('noam-a11y-motion');
    assert.equal(off(),true);
    parent.classes.delete('noam-a11y-motion');
    parent.dataset.ndMotion='off';
    assert.equal(off(),true);
    delete parent.dataset.ndMotion;
    parent.classes.delete('nd-motion-enabled');
    assert.equal(off(),true,'return to the device preference restores static behavior');
  });
}

for (const film of films.slice(1)) {
  it(`${film}: the mounted wrapper leaves pause ownership with the embedded player`, () => {
    const wrapperName = film === 'parallel-cointerior-angles' ? 'ParallelCointeriorLoop' : 'FactoringFilmLoop';
    const wrapper = readFileSync(new URL(`../src/components/${wrapperName}.astro`, import.meta.url), 'utf8');
    const script = wrapper.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    const source = readFileSync(new URL(`../public/loops/${film}.html`, import.meta.url), 'utf8');
    const own = html(), parent = html();
    parent.classes.add('nd-motion-enabled');
    const player = {
      playing: true, plays: 0,
      isPlaying() { return this.playing; },
      pause() { this.playing = false; },
      play() { this.playing = true; this.plays++; },
    };
    const outerObservers: Array<() => void> = [];
    const frame = {
      style: {}, clientHeight: 400,
      contentWindow: { mathScene: player },
      contentDocument: {
        querySelector: () => ({ getBoundingClientRect: () => ({ height: 400 }) }),
        getElementById: () => ({ contentWindow: { mathScene: player } }),
      },
      addEventListener() {},
    };
    // Run the real outer wrapper first, matching browser observer registration
    // order. A second owner must not pause before the player records policyHeld.
    runInNewContext(script, {
      document: { documentElement: parent, querySelectorAll: () => [{ querySelector: () => frame }] },
      window: {},
      MutationObserver: class {
        constructor(private callback: () => void) {}
        observe() { outerObservers.push(this.callback); }
      },
    });
    const sync = runInNewContext(`${functionSource(source, 'motionOff')}; ${functionSource(source, 'syncMotion')}; syncMotion`, {
      window: { parent: { document: { documentElement: parent } } },
      document: { documentElement: own }, reducedMotion: { matches: true },
      api: player, policyHeld: false, exploring: false, seeking: false, syncPlaybackButton() {},
    });
    const setStopped = (off: boolean) => {
      if (off) parent.classes.add('nd-motion-off');
      else parent.classes.delete('nd-motion-off');
      outerObservers.forEach(callback => callback());
      sync();
    };
    setStopped(true);
    assert.equal(player.playing, false);
    setStopped(false);
    assert.equal(player.playing, true, 'active playback resumes after the global stop is released');
    player.pause();
    const plays = player.plays;
    setStopped(true);
    setStopped(false);
    assert.equal(player.playing, false, 'a visitor pause survives policy changes');
    assert.equal(player.plays, plays);
  });

  it(`${film}: resumes a policy pause without resuming a visitor pause`, () => {
    const source=readFileSync(new URL(`../public/loops/${film}.html`,import.meta.url),'utf8');
    const own=html(), parent=html();
    const player={playing:false,plays:0,isPlaying(){return this.playing;},pause(){this.playing=false;},play(){this.playing=true;this.plays++;}};
    const sync=runInNewContext(`${functionSource(source,'motionOff')}; ${functionSource(source,'syncMotion')}; syncMotion`, {
      window:{parent:{document:{documentElement:parent}}},document:{documentElement:own},reducedMotion:{matches:true},
      api:player,policyHeld:true,exploring:false,seeking:false,syncPlaybackButton(){},
    });
    parent.classes.add('nd-motion-enabled'); sync();
    assert.equal(player.playing,true,'initially reduced playback starts after opt-in');
    parent.classes.add('nd-motion-off'); sync();
    assert.equal(player.playing,false);
    parent.classes.delete('nd-motion-off'); sync();
    assert.equal(player.playing,true,'policy-held playback resumes');
    player.pause();
    const before=player.plays;
    parent.classes.add('nd-motion-off'); sync();
    parent.classes.delete('nd-motion-off'); sync();
    assert.equal(player.playing,false,'manual pause remains paused');
    assert.equal(player.plays,before);
  });
}
