import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Trophy, Radio, BriefcaseBusiness } from 'lucide-react';
import { audio } from '../System/Audio';

const chapters = [
  {
    tag: '01 / AN INVITATION TO THE ARENA', title: 'ONE GAME.\nMANY FUTURES.',
    lead: 'Your community is preparing a basketball showcase, and you have been invited to help bring it to life.',
    detail: 'You arrive expecting to see only players. Instead, a coach plans practice, a camera crew checks its equipment, and an organiser welcomes volunteers. The event leader gives you a challenge: explore the team behind the game and discover where your own strengths could fit. Over this story, you will follow the showcase from training to tip-off—and find opportunities that reach far beyond scoring baskets.',
    cards: [
      ['A PLACE FOR DIFFERENT TALENTS', 'Sport needs people who enjoy movement, teaching, storytelling, numbers, design and organising. You do not have to be a professional athlete to contribute.'],
      ['MORE THAN ONE KIND OF WORK', 'Opportunities can include club jobs, community projects, freelance assignments and small businesses. Some are paid; others are learning or volunteer experiences.'],
      ['YOUR MISSION', 'As you meet each team, notice one role that interests you, one skill you could practise and one small project you could try.']
    ]
  },
  {
    tag: '02 / THE TRAINING SESSION', title: 'DEVELOP TALENT.\nBUILD CONFIDENCE.',
    lead: 'On the practice court, a young player keeps missing a pass. The coach slows the drill down and helps them try again.',
    detail: 'You discover that performance is built through patient work. Athletes practise movement, teamwork and decision-making. Coaches observe players, plan sessions and explain techniques in ways different learners understand. Referees support fair play by applying the rules and communicating decisions calmly. These roles need preparation, reliability and respect as much as enthusiasm for winning.',
    cards: [
      ['ATHLETE & COACH', 'Players develop sporting ability and teamwork. Coaches organise drills, give useful feedback and support development. Practise explaining a simple skill clearly to a teammate.'],
      ['REFEREE & OFFICIAL', 'Officials manage time, scores, rules and fair competition. Start by learning your sport’s rules and asking a club how supervised officiating works.'],
      ['TRY A FIRST STEP', 'Observe a local training session with permission. Write a short practice plan and ask a coach for feedback. Ask the relevant club or federation about training and entry requirements.']
    ]
  },
  {
    tag: '03 / BEHIND THE PERFORMANCE', title: 'SUPPORT PEOPLE.\nSTRENGTHEN THE TEAM.',
    lead: 'Behind the court, the support team prepares equipment and makes sure the players know where to get help.',
    detail: 'Fitness trainers plan physical conditioning, while qualified health professionals support areas such as injury assessment and rehabilitation. Equipment staff check kits and supplies. Analysts study game footage and statistics to help coaches understand patterns. You notice how careful records, clear communication and attention to each person help the whole team prepare.',
    cards: [
      ['FITNESS & HEALTH', 'Fitness work focuses on conditioning; physiotherapy and other clinical roles require appropriate professional education and credentials. Explore their training routes with a qualified practitioner.'],
      ['DATA & PERFORMANCE ANALYSIS', 'Analysts track useful patterns such as turnovers and shot locations. Try recording one quarter of a match and explain one finding, including what your small sample cannot tell you.'],
      ['EQUIPMENT & OPERATIONS', 'A kit manager tracks uniforms, balls and supplies. Make a simple inventory for a team project and practise checking items in and out accurately.']
    ]
  },
  {
    tag: '04 / TELLING THE STORY', title: 'CAPTURE MOMENTS.\nCONNECT WITH FANS.',
    lead: 'A photographer asks you what makes today’s showcase special. You realise the story belongs to the whole community.',
    detail: 'Sports media helps people understand and enjoy the event. Commentators explain the action, journalists check facts and interview people, and photographers and video editors capture meaningful moments. Designers and social media teams turn information into posters, highlights and updates. Good storytelling requires accuracy, preparation and permission to use people’s images and other creators’ work.',
    cards: [
      ['COMMENTARY & JOURNALISM', 'Research the teams, learn to pronounce names and describe action clearly. Try writing a short match report that separates observed facts from your opinions.'],
      ['PHOTO, VIDEO & DESIGN', 'Practise framing, editing, captions and clear layouts. With permission, create a poster or short highlight about a school or club activity.'],
      ['BUILD A SMALL PORTFOLIO', 'Keep a few examples of your work and explain your role in each. Ask for feedback, credit collaborators and get permission before recording or publishing people.']
    ]
  },
  {
    tag: '05 / MAKING MATCH DAY HAPPEN', title: 'ORGANISE THE DAY.\nCREATE OPPORTUNITIES.',
    lead: 'The organiser shows you the schedule: team arrivals, equipment checks, accessible entrances and the first whistle.',
    detail: 'Event managers coordinate venues, people and timing. Club administrators handle records and communication. Sports marketers help an event reach its audience, while sponsorship teams explain how a partner could support it and what that partner receives. Entrepreneurs may offer products or services such as kit design, equipment repair or event photography. A useful idea must answer a real need and have realistic costs.',
    cards: [
      ['EVENTS & CLUB MANAGEMENT', 'Build schedules, coordinate helpers and communicate changes. Try planning a small activity with an organiser, including responsibilities, access needs and a backup plan.'],
      ['MARKETING & SPONSORSHIP', 'Understand the audience and explain the event’s value honestly. Draft a sample promotion and a partnership idea with clear deliverables instead of promises you cannot prove.'],
      ['SPORTS ENTERPRISE', 'Ask a club what problem it needs solved. Sketch a service, list materials and time costs, and ask for feedback before spending money. Revenue is not the same as profit.']
    ]
  },
  {
    tag: '06 / A GAME THAT WELCOMES EVERYONE', title: 'OPEN THE DOOR.\nMAKE A DIFFERENCE.',
    lead: 'At the entrance, a community organiser helps a newcomer find a welcoming group. That first welcome matters.',
    detail: 'Sport can also be a place to serve others. Youth workers, teachers, community coaches and inclusion coordinators help people participate and feel that they belong. Their work includes listening, adapting activities and helping remove barriers. Sports technology teams can support them with tools for schedules, registration or accessible information. You begin to see opportunity as both meaningful work and a contribution to your community.',
    cards: [
      ['COMMUNITY & INCLUSION', 'Help an established programme welcome people with different abilities and backgrounds. Learn its safeguarding and accessibility practices before taking responsibility for participants.'],
      ['TECHNOLOGY & PRODUCT DESIGN', 'Develop tools around an actual need. Sketch a simple team schedule or equipment tracker, ask a user to try it and improve the parts they find confusing.'],
      ['CHOOSE YOUR NEXT STEP', 'Pick a role, identify a skill gap and find a club, teacher or training programme to learn from. Entry routes vary; ask about qualifications, supervision and whether a role is paid.']
    ]
  },
  {
    tag: '07 / YOUR TURN AT TIP-OFF', title: 'PLAY THE GAME.\nPLAN YOUR FUTURE.',
    lead: 'The lights come on. The crowd is ready. Every person you met has helped make this moment possible.',
    detail: 'Now take your place on the court. This arcade run challenges your timing and decisions; it does not qualify you for a sports career. As you pass the fans, hoops and sidelines, remember the people behind them. After the match, choose one role from the story and set a small goal: make a sample project, practise one skill or ask a local organisation how to get involved.',
    cards: [
      ['DRIBBLE & COLLECT', 'Use ← / → or A / D to change lanes; swipe left or right on mobile. Collect basketballs and B-A-S-K-E-T letters while avoiding obstacles.'],
      ['JUMP & DUNK', 'Use Space / ↑ / W or swipe up to jump. Follow the on-screen timing cues at a hoop. Use earned game points for locker-room upgrades.'],
      ['PAUSE & REFLECT', 'Press Esc / P or use the mobile pause control. After your run, answer: Which role interested me? What skill does it need? What can I try this week?']
    ]
  },
];

export function OpportunityIntro({ onComplete, isNewGame = false }: { onComplete: () => void; isNewGame?: boolean }) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const chapter = chapters[step];
  const change = (next: number) => { audio.playClick(); setStep(next); };
  return <section className="opportunity-intro" aria-label="SportBiz story: opportunities in sports">
    <header className="briefing-top"><span>SPORTBIZ <b>/ SLAM RUNNER</b></span><button onClick={onComplete}>{isNewGame ? 'Skip story & play' : 'Back to locker room'} <ArrowRight size={16} /></button></header>
    <div className="briefing-layout">
      <div className="briefing-copy" key={step}>
        <p className="briefing-eyebrow">{chapter.tag} · {step + 1} OF {chapters.length}</p>
        <h1 ref={heading} tabIndex={-1}>{chapter.title.split('\n').map((line, i) => <span key={line} className={i ? 'accent' : ''}>{line}</span>)}</h1>
        <p className="briefing-lead">{chapter.lead}</p>
        <p className="briefing-detail">{chapter.detail}</p>
        <div className="briefing-actions">
          {step > 0 && <button className="briefing-back" aria-label="Previous page" onClick={() => change(step - 1)}><ArrowLeft size={22} /></button>}
          <button className="btn-game btn-primary briefing-next" onClick={() => step === chapters.length - 1 ? onComplete() : change(step + 1)}>{step === chapters.length - 1 ? (isNewGame ? 'START THE MATCH' : 'BACK TO LOCKER ROOM') : 'CONTINUE THE STORY'}<ArrowRight size={22} /></button>
        </div>
        <nav className="briefing-progress" aria-label="Introduction pages">{chapters.map((c, i) => <button key={c.tag} aria-label={`Chapter ${i + 1}: ${c.tag.split(' / ')[1]}`} aria-current={step === i ? 'step' : undefined} onClick={() => change(i)}><span />0{i + 1}</button>)}</nav>
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
