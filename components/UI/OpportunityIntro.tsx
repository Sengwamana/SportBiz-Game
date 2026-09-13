import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Trophy, Radio, BriefcaseBusiness } from 'lucide-react';
import { audio } from '../System/Audio';

const chapters = [
  { tag: '01 / THE BIGGER GAME', title: 'YOUR FUTURE.\nBEYOND THE COURT.', lead: 'Love sport? There is more than one way to be part of the game.', detail: 'Sport brings together athletes, coaches, creators and entrepreneurs. Step into the arena and discover where your interests could take you.', cards: [ ['PERFORM', 'Athlete · Coach · Fitness trainer'], ['CREATE', 'Commentator · Photographer · Content creator'], ['BUILD', 'Event organiser · Sports marketer · Club manager'] ] },
  { tag: '02 / PLAY WITH PURPOSE', title: 'MAKE MOVES.\nSEE POSSIBILITIES.', lead: 'Every great performance has a team behind it.', detail: 'Your run is an arcade challenge: collect basketballs, dodge defenders and spend points on upgrades. Use those moments to think about the people who make real sport happen.', cards: [ ['ON THE COURT', 'Timing and practice → coaching and player development'], ['IN THE LOCKER ROOM', 'Recovery and equipment → fitness and sports products'], ['AROUND THE ARENA', 'Crowds and match days → media, events and sponsorship'] ] },
  { tag: '03 / YOUR FIRST MISSION', title: 'OWN YOUR LANE.\nLIGHT UP THE ARENA.', lead: 'Chase your best run. Find your place in sport.', detail: 'Move between lanes, collect basketballs and avoid obstacles. Jump toward hoops for dunks and use earned points in the locker room. After your run, pick a sport role you would like to explore.', cards: [ ['MOVE', '← → or A / D · Swipe left or right'], ['JUMP', 'Space / ↑ / W · Swipe up'], ['TAKE A BREATHER', 'Esc / P to pause · Use the pause button on mobile'] ] },
];

export function OpportunityIntro({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const chapter = chapters[step];
  const change = (next: number) => { audio.playClick(); setStep(next); };
  return <section className="opportunity-intro" aria-label="Welcome to SportBiz">
    <header className="briefing-top"><span>SPORTBIZ <b>/ SLAM RUNNER</b></span><button onClick={onComplete}>Skip to locker room <ArrowRight size={16} /></button></header>
    <div className="briefing-layout">
      <div className="briefing-copy" key={step}>
        <p className="briefing-eyebrow">{chapter.tag}</p>
        <h1 ref={heading} tabIndex={-1}>{chapter.title.split('\n').map((line, i) => <span key={line} className={i ? 'accent' : ''}>{line}</span>)}</h1>
        <p className="briefing-lead">{chapter.lead}</p>
        <p className="briefing-detail">{chapter.detail}</p>
        <div className="briefing-actions">
          {step > 0 && <button className="briefing-back" aria-label="Previous page" onClick={() => change(step - 1)}><ArrowLeft size={22} /></button>}
          <button className="btn-game btn-primary briefing-next" onClick={() => step === 2 ? onComplete() : change(step + 1)}>{step === 2 ? 'ENTER THE LOCKER ROOM' : step === 0 ? 'DISCOVER YOUR OPPORTUNITIES' : 'GET MATCH READY'}<ArrowRight size={22} /></button>
        </div>
        <nav className="briefing-progress" aria-label="Introduction pages">{chapters.map((c, i) => <button key={c.tag} aria-label={`Page ${i + 1}`} aria-current={step === i ? 'step' : undefined} onClick={() => change(i)}><span />0{i + 1}</button>)}</nav>
      </div>
      <aside className="briefing-pathways" aria-label="Sport pathways">
        <div className="arena-label"><span /> LIVE FROM THE ARENA</div>
        {chapter.cards.map(([title, description], i) => { const Icon = [Trophy, Radio, BriefcaseBusiness][i]; return <article className="pathway" key={title}><Icon size={25} /><div><h2>{title}</h2><p>{description}</p></div><span className="pathway-number">0{i + 1}</span></article>; })}
        <p className="briefing-footnote">Take it beyond the game: choose one role, learn the skills it needs, and look for a local club or project to get involved.</p>
      </aside>
    </div>
    <footer className="briefing-bottom"><span>ONE ARENA. MANY POSSIBILITIES.</span><span>DRIBBLE / DODGE / DUNK</span></footer>
  </section>;
}
