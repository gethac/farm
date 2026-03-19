interface RegisterScreenProps {
  displayName: string;
  password: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onDisplayNameChange(value: string): void;
  onPasswordChange(value: string): void;
  onSubmit(event?: { preventDefault(): void }): void;
  onSwitchMode(): void;
}

export function RegisterScreen(props: RegisterScreenProps) {
  return (
    <section className="auth-card auth-card--register">
      <div className="auth-card__badge">新农场主报到</div>
      <h1>创建农场账号</h1>
      <p>注册后即可进入移动端经典农场主页，开始种植和收获。</p>
      <form className="auth-form" onSubmit={props.onSubmit}>
        <label>
          <span>昵称</span>
          <input value={props.displayName} onChange={(event) => props.onDisplayNameChange(event.target.value)} />
        </label>
        <label>
          <span>密码</span>
          <input type="password" value={props.password} onChange={(event) => props.onPasswordChange(event.target.value)} />
        </label>
        {props.errorMessage ? <strong className="auth-error">{props.errorMessage}</strong> : null}
        <button type="submit" disabled={props.isSubmitting}>{props.isSubmitting ? '注册中...' : '注册'}</button>
      </form>
      <button type="button" className="auth-switch" onClick={props.onSwitchMode}>已有账号？去登录</button>
    </section>
  );
}
