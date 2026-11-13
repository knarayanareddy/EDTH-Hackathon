import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { Notes } from '../src/components/Notes';
import { FrameSource } from '../src/lib/source';
import { defaultCfg } from '../src/lib/pipeline';
import { InstanceView } from '../src/components/InstanceView';
import { CompareView } from '../src/components/CompareView';
const src = new FrameSource({ kind: 'synthetic', preset: 'horizon_pan', corr: 'vertical', full: false, stripeScale: 1, sigmaScale: 1 });
const cfgs = { O: defaultCfg('O'), A: defaultCfg('A'), B: defaultCfg('B'), C: defaultCfg('C') };
const out = { App: renderToString(<App />).length, Notes: renderToString(<Notes />).length,
  A: renderToString(<InstanceView variant="A" source={src} frameIdx={0} playing={false} cfg={cfgs.A} setCfg={() => {}} />).length,
  B: renderToString(<InstanceView variant="B" source={src} frameIdx={0} playing={false} cfg={cfgs.B} setCfg={() => {}} />).length,
  C: renderToString(<InstanceView variant="C" source={src} frameIdx={0} playing={false} cfg={cfgs.C} setCfg={() => {}} />).length,
  Compare: renderToString(<CompareView source={src} frameIdx={0} playing={false} cfgs={cfgs} />).length };
console.log('SSR render OK (html bytes):', JSON.stringify(out));
