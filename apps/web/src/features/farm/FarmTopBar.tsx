export function FarmTopBar(props: {
  displayName: string;
  level: number;
  coins: number;
  experience: number;
  notificationCount: number;
  onOpenNotifications(): void;
}) {
  return (
    <header className="farm-hud-top">
      <div className="farm-hud-top__profile">
        <div className="farm-hud-top__avatar" aria-hidden="true">
          农
        </div>
        <div className="farm-hud-top__copy">
          <strong>{props.displayName}</strong>
          <span>Lv.{props.level} 农场新星</span>
        </div>
      </div>
      <div className="farm-hud-top__currencies">
        <div className="farm-hud-top__chip">
          <span>金币</span>
          <strong>{props.coins}</strong>
        </div>
        <div className="farm-hud-top__chip">
          <span>经验</span>
          <strong>{props.experience}</strong>
        </div>
      </div>
      <button type="button" className="farm-hud-top__notice" onClick={props.onOpenNotifications}>
        铃
        <em>{props.notificationCount}</em>
      </button>
    </header>
  );
}
