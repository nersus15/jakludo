import React, { useEffect, useState } from 'react';
import AppHeader from './components/AppHeader';
import GameHeader from './components/game/GameHeader';
import Toasts from './components/Toasts';
import { ReconnectBar } from './components/NetworkStatus';
import InstallGuide from './components/InstallGuide';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import AuthModal from './AuthModal';
import LeaderboardModal from './LeaderboardModal';
import AudioSettingsModal from './AudioSettingsModal';
import ShopModal from './ShopModal';
import { useAuth } from './hooks/useAuth';
import { useGameRoom } from './hooks/useGameRoom';
import { useActiveRooms } from './hooks/useActiveRooms';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useTheme } from './hooks/useTheme';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useItemCatalog } from './items';
import { sound } from './sound';

export default function App() {
  const [modal, setModal] = useState(null); // 'auth' | 'shop' | 'audio' | 'leaderboard' | null
  const [audio, setAudio] = useState(sound.getState());
  const [sheet, setSheet] = useState(null); // bottom sheet di layar permainan: 'chat' | 'scores'
  const auth = useAuth();
  const game = useGameRoom({
    authToken: auth.authToken,
    currentUser: auth.currentUser,
    onNeedLogin: () => setModal('auth')
  });
  const network = useNetworkStatus(game.socket);
  const theme = useTheme();
  const pwa = usePwaInstall({ onBeforePrompt: () => sound.playClick() });
  const activeRooms = useActiveRooms({ enabled: game.screen === 'home', authToken: auth.authToken });
  const itemCatalog = useItemCatalog();

  useEffect(() => sound.subscribe(state => setAudio({ ...state })), []);

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
        chatToast={game.chatToast}
        reactions={game.reactions}
        onOpenChat={() => {
          game.actions.dismissChatToast();
          if (inGame) changeSheet('chat');
        }}
        onDismissChat={game.actions.dismissChatToast}
      />

      {inGame ? (
        <GameScreen game={game} itemCatalog={itemCatalog} sheet={sheet} onSheetChange={changeSheet} onOpenShop={open('shop')} />
      ) : inLobby ? (
        <LobbyScreen room={game.room} me={game.me} playerId={game.playerId} error={game.error} actions={game.actions} />
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

      <AuthModal
        isOpen={modal === 'auth'}
        onClose={close}
        onLoginSuccess={(user, token) => {
          auth.loginSuccess(user, token);
          close();
        }}
      />
      <LeaderboardModal isOpen={modal === 'leaderboard'} onClose={close} currentUser={auth.currentUser} socket={game.socket} />
      <AudioSettingsModal isOpen={modal === 'audio'} onClose={close} />
      <ShopModal isOpen={modal === 'shop'} onClose={close} currentUser={auth.currentUser} onUpdateUser={auth.setCurrentUser} authToken={auth.authToken} />
      <InstallGuide platform={pwa.installGuide} onClose={pwa.closeInstallGuide} />
    </div>
  );
}
