import React from 'react';
import Icon from './Icon';
import { sound } from '../sound';

const NAV_ITEMS = [
  { key: 'home', icon: 'home', label: 'Beranda' },
  { key: 'friends', icon: 'friends', label: 'Teman' },
  { key: 'groups', icon: 'chat', label: 'Grup & Chat' },
  { key: 'shop', icon: 'shop', label: 'Toko Item' }
];

export default function MobileBottomNav({
  activeModal,
  friendBadgeCount = 0,
  groupBadgeCount = 0,
  onSelectHome,
  onOpenFriends,
  onOpenGroups,
  onOpenShop
}) {
  const activeKey =
    activeModal === 'friends'
      ? 'friends'
      : activeModal === 'groups'
      ? 'groups'
      : activeModal === 'shop'
      ? 'shop'
      : 'home';

  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex(item => item.key === activeKey)
  );

  const handleSelect = key => {
    sound.playClick();
    if (key === 'home') {
      onSelectHome?.();
      return;
    }
    if (key === activeModal) {
      onSelectHome?.();
      return;
    }
    if (key === 'friends') onOpenFriends?.();
    else if (key === 'groups') onOpenGroups?.();
    else if (key === 'shop') onOpenShop?.();
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigasi utama">
      <div
        className="mobile-bottom-nav__bar"
        style={{ '--active-index': activeIndex }}
      >
        {/* Lekukan (notch) & lingkaran oranye aktif yang bergeser mulus */}
        <div className="mobile-bottom-nav__indicator" aria-hidden="true">
          <div className="mobile-bottom-nav__notch">
            <div className="mobile-bottom-nav__orb" />
          </div>
        </div>

        <ul className="mobile-bottom-nav__list">
          {NAV_ITEMS.map((item, idx) => {
            const isActive = idx === activeIndex;
            const badge =
              item.key === 'friends'
                ? friendBadgeCount
                : item.key === 'groups'
                ? groupBadgeCount
                : 0;

            return (
              <li key={item.key} className="mobile-bottom-nav__item">
                <button
                  type="button"
                  className={`mobile-bottom-nav__btn ${isActive ? 'is-active' : ''}`}
                  aria-label={
                    badge > 0 ? `${item.label} (${badge} notifikasi baru)` : item.label
                  }
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleSelect(item.key)}
                >
                  <span className="mobile-bottom-nav__icon">
                    <Icon name={item.icon} size={22} />
                    {badge > 0 && (
                      <span className="mobile-bottom-nav__badge" aria-hidden="true">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="mobile-bottom-nav__label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

