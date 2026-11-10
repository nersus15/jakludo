import React, { Suspense, lazy, useEffect, useState } from 'react';
import AppHeader from './components/AppHeader';
import GameHeader from './components/game/GameHeader';
import Toasts from './components/Toasts';
import { ReconnectBar } from './components/NetworkStatus';
import InstallGuide from './components/InstallGuide';
import NotificationPrompt from './components/NotificationPrompt';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import AudioSettingsModal from './AudioSettingsModal';
import { useAuth } from './hooks/useAuth';
import { useGameRoom } from './hooks/useGameRoom';
import { useSocial } from './hooks/useSocial';
import { useActiveRooms } from './hooks/useActiveRooms';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useTheme } from './hooks/useTheme';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useItemCatalog } from './items';
import { sound } from './sound';

// Dialog yang jarang dibuka dimuat terpisah agar bundle awal lebih kecil.
// Diunduh di belakang layar saat browser senggang, jadi tetap langsung muncul saat dibuka.
const loadAuth = () => import('./AuthModal');
const loadLeaderboard = () => import('./LeaderboardModal');
const loadShop = () => import('./ShopModal');
const loadFriends = () => import('./social/FriendsModal');
const loadGroups = () => import('./screens/GroupsScreen');
const AuthModal = lazy(loadAuth);
const LeaderboardModal = lazy(loadLeaderboard);
const ShopModal = lazy(loadShop);
const FriendsModal = lazy(loadFriends);
const GroupsScreen = lazy(loadGroups);

function preloadDialogs() {
  const run = () => [loadAuth, loadLeaderboard, loadShop, loadFriends, loadGroups].forEach(load => load().catch(() => {}));
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

export default function App() {
  const [modal, setModal] = useState(null); // 'auth' | 'shop' | 'audio' | 'leaderboard' | 'friends' | 'groups' | null
  const [audio, setAudio] = useState(sound.getState());
  const [sheet, setSheet] = useState(null); // bottom sheet di layar permainan: 'chat' | 'scores'
  const auth = useAuth();
  const game = useGameRoom({
    authToken: auth.authToken,
    currentUser: auth.currentUser,
    onNeedLogin: () => setModal('auth')
  });
  const social = useSocial({
    socket: game.socket,
    authToken: auth.authToken,
    currentUser: auth.currentUser
  });
  const network = useNetworkStatus(game.socket);
  const theme = useTheme();
  const pwa = usePwaInstall({ onBeforePrompt: () => sound.playClick() });
  const activeRooms = useActiveRooms({ enabled: game.screen === 'home', authToken: auth.authToken });
  const itemCatalog = useItemCatalog();

  useEffect(() => sound.subscribe(state => setAudio({ ...state })), []);
  useEffect(preloadDialogs, []);

  // Status chat terbuka dipakai untuk menghitung pesan belum dibaca
  const changeSheet = name => {
    setSheet(name);
    game.actions.setChatOpen(name === 'chat');
  };

  const open = name => () => setModal(name);
  const close = () => setModal(null);
  const openAudio = () => {
    sound.init();
    sound.playClick();
    setModal('audio');
  };

  const inGame = game.screen === 'room' && game.room?.started;
  const inLobby = game.screen === 'room' && game.room && !game.room.started;

  return (
    <div className={`app ${inGame ? 'app--game' : ''}`}>
      <a className="skip-link" href="#main">Langsung ke konten</a>
      <ReconnectBar {...network} />

      {inGame ? (
        <GameHeader
          room={game.room}
          audio={audio}
          network={network}
          onOpenShop={open('shop')}
          theme={theme}
          onOpenAudio={openAudio}
          onLeave={game.actions.leaveRoom}
        />
      ) : (
        <AppHeader
          user={auth.currentUser}
          audio={audio}
          network={network}
          friendBadgeCount={social.friendBadgeCount}
          groupBadgeCount={social.groupBadgeCount}
          onOpenFriends={open('friends')}
          onOpenGroups={open('groups')}
          onOpenShop={open('shop')}
          theme={theme}
          onOpenAudio={openAudio}
          onOpenAuth={open('auth')}
          onOpenLeaderboard={open('leaderboard')}
          onLogout={auth.logout}
        />
      )}

      <Toasts
        error={inGame ? game.error : ''}
        memberNotice={game.memberNotice}
        roomInvite={social.roomInvite}
        chatToast={game.chatToast}
        reactions={game.reactions}
        onAcceptRoomInvite={targetCode => {
          social.actions.dismissRoomInvite();
          setModal(null);
          game.actions.joinRoom(targetCode);
        }}
        onDismissRoomInvite={social.actions.dismissRoomInvite}
        onOpenChat={() => {
          game.actions.dismissChatToast();
          if (inGame) changeSheet('chat');
        }}
        onDismissChat={game.actions.dismissChatToast}
      />

      {inGame ? (
        <GameScreen game={game} itemCatalog={itemCatalog} sheet={sheet} onSheetChange={changeSheet} onOpenShop={open('shop')} />
      ) : inLobby ? (
        <LobbyScreen
          room={game.room}
          me={game.me}
          playerId={game.playerId}
          currentUser={auth.currentUser}
          error={game.error}
          actions={game.actions}
          social={social}
          onOpenFriends={open('friends')}
        />
      ) : game.screen === 'room' ? (
        <main className="loading-screen" id="main" role="status">
          <span className="spinner" aria-hidden="true" /> Masuk ke room...
        </main>
      ) : (
        <HomeScreen
          user={auth.currentUser}
          checkingAuth={auth.checking}
          code={game.code}
          error={game.error}
          activeRooms={activeRooms}
          isInstalled={pwa.isInstalled}
          actions={game.actions}
          friendBadgeCount={social.friendBadgeCount}
          groupBadgeCount={social.groupBadgeCount}
          onOpenFriends={open('friends')}
          onOpenGroups={open('groups')}
          onOpenAuth={open('auth')}
          onOpenLeaderboard={open('leaderboard')}
          onInstall={pwa.install}
        />
      )}

      {!inGame && (
        <footer className="app-footer">
          <span>© 2026 JakLudo</span>
          <span>Ludo online untuk main bareng teman</span>
        </footer>
      )}

      <Suspense fallback={null}>
        {modal === 'auth' && (
          <AuthModal
            isOpen
            onClose={close}
            onLoginSuccess={(user, token) => {
              auth.loginSuccess(user, token);
              close();
            }}
          />
        )}
        {modal === 'leaderboard' && <LeaderboardModal isOpen onClose={close} currentUser={auth.currentUser} socket={game.socket} />}
        {modal === 'shop' && <ShopModal isOpen onClose={close} currentUser={auth.currentUser} onUpdateUser={auth.setCurrentUser} authToken={auth.authToken} />}
        {modal === 'friends' && (
          <FriendsModal
            isOpen
            onClose={close}
            currentUser={auth.currentUser}
            social={social}
            onOpenAuth={open('auth')}
          />
        )}
        {modal === 'groups' && (
          <GroupsScreen
            isOpen
            onClose={close}
            currentUser={auth.currentUser}
            social={social}
            gameActions={game.actions}
            onOpenAuth={open('auth')}
          />
        )}
      </Suspense>
      <AudioSettingsModal isOpen={modal === 'audio'} onClose={close} />
      <InstallGuide platform={pwa.installGuide} onClose={pwa.closeInstallGuide} />
      <NotificationPrompt enabled={game.screen === 'home' && !modal && !pwa.installGuide} />
    </div>
  );
}
