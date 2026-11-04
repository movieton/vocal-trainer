import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Activity, BookOpen, Ear, Ellipsis, MoveVertical, Music, PenLine, Sun, TrendingUp, Wind } from 'lucide-react'
import Compose from './pages/Compose'
import Home from './pages/Home'
import Library from './pages/Library'
import Trainer from './pages/Trainer'
import Tuner from './pages/Tuner'
import RangeTest from './pages/RangeTest'
import { More } from './pages/Stubs'
import Progress from './pages/Progress'
import { TheoryArticle, TheoryList } from './pages/Theory'
import { BreathList, BreathRun } from './pages/Breath'
import EarHub from './pages/EarHub'
import { ChordSing, ChordVoice, Harmony, PitchMatch, ScaleSing, SingDegree, SingInterval } from './pages/EarDrills'
import { ChordQuiz, FunctionalQuiz, IntervalQuiz } from './pages/EarQuiz'
import Circle from './pages/Circle'
import Rhythm from './pages/Rhythm'
import Drone from './pages/Drone'
import Threshold from './pages/Threshold'
import Dictation from './pages/Dictation'
import { Levels, Melody } from './pages/EarMore'

const NAV = [
  { to: '/', label: 'Сегодня', icon: Sun, main: true },
  { to: '/library', label: 'Распевки', icon: Music, main: true },
  { to: '/tuner', label: 'Тюнер', icon: Activity, main: true },
  { to: '/ear', label: 'Слух', icon: Ear, main: true },
  { to: '/compose', label: 'Сочинение', icon: PenLine },
  { to: '/breath', label: 'Дыхание', icon: Wind },
  { to: '/theory', label: 'Теория', icon: BookOpen },
  { to: '/range', label: 'Диапазон', icon: MoveVertical },
  { to: '/progress', label: 'Прогресс', icon: TrendingUp },
]

export default function App() {
  return (
    <HashRouter>
      <div className="shell">
        <aside className="side">
          <div className="brand">Распевка</div>
          <nav>{NAV.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={20} strokeWidth={1.75} />{n.label}</NavLink>)}</nav>
        </aside>
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/ex/:id" element={<Trainer />} />
            <Route path="/tuner" element={<Tuner />} />
            <Route path="/range" element={<RangeTest />} />
            <Route path="/ear" element={<EarHub />} />
            <Route path="/ear/match" element={<PitchMatch />} />
            <Route path="/ear/sing-interval" element={<SingInterval />} />
            <Route path="/ear/scales" element={<ScaleSing />} />
            <Route path="/ear/chords" element={<ChordSing />} />
            <Route path="/ear/harmony" element={<Harmony />} />
            <Route path="/ear/intervals" element={<IntervalQuiz />} />
            <Route path="/ear/chord-quality" element={<ChordQuiz />} />
            <Route path="/ear/circle" element={<Circle />} />
            <Route path="/ear/levels" element={<Levels />} />
            <Route path="/ear/melody" element={<Melody />} />
            <Route path="/ear/rhythm" element={<Rhythm />} />
            <Route path="/ear/drone" element={<Drone />} />
            <Route path="/ear/degrees" element={<FunctionalQuiz />} />
            <Route path="/ear/threshold" element={<Threshold />} />
            <Route path="/ear/dictation" element={<Dictation />} />
            <Route path="/ear/chord-voice" element={<ChordVoice />} />
            <Route path="/ear/sing-degree" element={<SingDegree />} />
            <Route path="/breath" element={<BreathList />} />
            <Route path="/breath/:id" element={<BreathRun />} />
            <Route path="/theory" element={<TheoryList />} />
            <Route path="/theory/:id" element={<TheoryArticle />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/more" element={<More />} />
          </Routes>
        </main>
        <nav className="tabbar">
          {NAV.filter(n => n.main).map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={20} strokeWidth={1.75} />{n.label}</NavLink>)}
          <NavLink to="/more"><Ellipsis size={20} strokeWidth={1.75} />Ещё</NavLink>
        </nav>
      </div>
    </HashRouter>
  )
}
