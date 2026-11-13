import { tr } from './lib/i18n'
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { Activity, BookOpen, UserRound, Ear, Ellipsis, Library as LibraryIcon, MoveVertical, Music, PenLine, Sun, TrendingUp, Wind } from 'lucide-react'
import { Suspense, lazy, useEffect, type ComponentType } from 'react'
import logo from './assets/brand/fasol-logo-cobalt.svg'
import logoWhite from './assets/brand/fasol-logo-white.svg'
import { UpdateBanner } from './components/Pwa'
import NotFound from './components/NotFound'
import { PauseOverlay } from './components/Mic'
import { PlanBar } from './components/PlanBar'
import LangSwitch from './components/LangSwitch'
import { AchievementToast } from './components/Achievements'
import Home from './pages/Home'
import Welcome from './pages/Welcome'
import { initAccount, useAccount } from './lib/account'
import { avatarSrc } from './lib/avatars'

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(load: () => Promise<T>, key: K) =>
  lazy(() => load().then(m => ({ default: m[key] as ComponentType<Record<string, never>> })))

const Compose = lazy(() => import('./pages/Compose'))
const Account = lazy(() => import('./pages/Account'))
const ResetPassword = lazyNamed(() => import('./pages/Account'), 'ResetPassword')
const Privacy = lazy(() => import('./pages/Privacy'))
const NotationList = lazyNamed(() => import('./pages/Notation'), 'NotationList')
const NotationLesson = lazyNamed(() => import('./pages/Notation'), 'NotationLesson')
const Library = lazy(() => import('./pages/Library'))
const LibItem = lazy(() => import('./pages/LibItem'))
const Trainer = lazy(() => import('./pages/Trainer'))
const Tuner = lazy(() => import('./pages/Tuner'))
const RangeTest = lazy(() => import('./pages/RangeTest'))
const More = lazyNamed(() => import('./pages/More'), 'More')
const Progress = lazy(() => import('./pages/Progress'))
const TheoryList = lazyNamed(() => import('./pages/Theory'), 'TheoryList')
const TheoryArticle = lazyNamed(() => import('./pages/Theory'), 'TheoryArticle')
const BreathList = lazyNamed(() => import('./pages/Breath'), 'BreathList')
const BreathRun = lazyNamed(() => import('./pages/Breath'), 'BreathRun')
const EarHub = lazy(() => import('./pages/EarHub'))
const PitchMatch = lazyNamed(() => import('./pages/EarDrills'), 'PitchMatch')
const SingInterval = lazyNamed(() => import('./pages/EarDrills'), 'SingInterval')
const ScaleSing = lazyNamed(() => import('./pages/EarDrills'), 'ScaleSing')
const ChordSing = lazyNamed(() => import('./pages/EarDrills'), 'ChordSing')
const Harmony = lazyNamed(() => import('./pages/EarDrills'), 'Harmony')
const ChordVoice = lazyNamed(() => import('./pages/EarDrills'), 'ChordVoice')
const SingDegree = lazyNamed(() => import('./pages/EarDrills'), 'SingDegree')
const IntervalQuiz = lazyNamed(() => import('./pages/EarQuiz'), 'IntervalQuiz')
const ChordQuiz = lazyNamed(() => import('./pages/EarQuiz'), 'ChordQuiz')
const FunctionalQuiz = lazyNamed(() => import('./pages/EarQuiz'), 'FunctionalQuiz')
const Circle = lazy(() => import('./pages/Circle'))
const Rhythm = lazy(() => import('./pages/Rhythm'))
const Drone = lazy(() => import('./pages/Drone'))
const Threshold = lazy(() => import('./pages/Threshold'))
const Dictation = lazy(() => import('./pages/Dictation'))
const KeyGames = lazy(() => import('./pages/KeyGames'))
const Levels = lazyNamed(() => import('./pages/EarMore'), 'Levels')
const Melody = lazyNamed(() => import('./pages/EarMore'), 'Melody')
const SongList = lazyNamed(() => import('./pages/Songs'), 'SongList')
const SongPage = lazyNamed(() => import('./pages/Songs'), 'SongPage')
const Course = lazy(() => import('./pages/Course'))

const NAV = [
  { to: '/', label: tr('Сегодня'), icon: Sun, main: true },
  { to: '/library', label: tr('Библиотека'), icon: LibraryIcon, main: true },
  { to: '/tuner', label: tr('Тюнер'), icon: Activity, main: true },
  { to: '/ear', label: tr('Слух'), icon: Ear, main: true },
  { to: '/songs', label: tr('Песни'), icon: Music },
  { to: '/compose', label: tr('Сочинение'), icon: PenLine },
  { to: '/breath', label: tr('Дыхание'), icon: Wind },
  { to: '/theory', label: tr('Теория'), icon: BookOpen },
  { to: '/range', label: tr('Диапазон'), icon: MoveVertical },
  { to: '/progress', label: tr('Прогресс'), icon: TrendingUp },
  { to: '/account', label: tr('Аккаунт'), icon: UserRound },
]

export default function App() {
  useEffect(() => { initAccount() }, [])
  const me = useAccount().user
  return (
    <HashRouter>
      <UpdateBanner />
      <PauseOverlay />
      <div className="shell">
        <aside className="side">
          <Link to="/" className="brand" aria-label={tr('fasol.app — на главную')}><img src={logo} alt="fasol.app" className="logo-light" /><img src={logoWhite} alt="" className="logo-dark" /></Link>
          <nav>{NAV.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'}>{n.to === '/account' && me?.avatarId ? <img src={avatarSrc(me.avatarId)} alt="" className="nav-av" /> : <n.icon size={20} strokeWidth={1.75} />}{n.label}</NavLink>)}</nav>
          <LangSwitch className="side-lang" />
        </aside>
        <main>
          <header className="mhead"><NavLink to="/" aria-label={tr('fasol.app — на главную')}><img src={logo} alt="fasol.app" className="logo-light" /><img src={logoWhite} alt="" className="logo-dark" /></NavLink></header>
          <PlanBar />
          <AchievementToast />
          <Suspense fallback={<div className="page"><p className="muted">{tr('Загрузка…')}</p></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/library" element={<Library />} />
            <Route path="/lib/:id" element={<LibItem />} />
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
            <Route path="/ear/keys" element={<KeyGames />} />
            <Route path="/ear/chord-voice" element={<ChordVoice />} />
            <Route path="/ear/sing-degree" element={<SingDegree />} />
            <Route path="/breath" element={<BreathList />} />
            <Route path="/breath/:id" element={<BreathRun />} />
            <Route path="/theory" element={<TheoryList />} />
            <Route path="/theory/:id" element={<TheoryArticle />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/songs" element={<SongList />} />
            <Route path="/songs/:id" element={<SongPage />} />
            <Route path="/course" element={<Course />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/more" element={<More />} />
            <Route path="/account" element={<Account />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/notation" element={<NotationList />} />
            <Route path="/notation/:id" element={<NotationLesson />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </main>
        <nav className="tabbar">
          {NAV.filter(n => n.main).map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={20} strokeWidth={1.75} />{n.label}</NavLink>)}
          <NavLink to="/more"><Ellipsis size={20} strokeWidth={1.75} />{tr('Ещё')}</NavLink>
        </nav>
      </div>
    </HashRouter>
  )
}
