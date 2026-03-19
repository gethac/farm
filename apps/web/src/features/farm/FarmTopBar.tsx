export function FarmTopBar(props: {
  displayName: string;
  level: number;
  coins: number;
  experience: number;
  notificationCount: number;
  onOpenNotifications(): void;
}) {
  return (
    <header className="top-bar">
      <div className="avatar-badge" aria-hidden="true">
        农
      </div>
      <div className="profile-copy">
        <strong>{props.displayName}</strong>
        <span>Lv.{props.level} 农场新星</span>
      </div>
      <div className="stat-chip">
        <span>金币</span>
        <strong>{props.coins}</strong>
      </div>
      <div className="stat-chip">
        <span>经验</span>
        <strong>{props.experience}</strong>
      </div>
      <button type="button" className="notice-button" onClick={props.onOpenNotifications}>
        铃
        <em>{props.notificationCount}</em>
      </button>
    </header>
  );
}
