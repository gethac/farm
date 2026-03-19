interface LoginScreenProps {
  displayName: string;
  password: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onDisplayNameChange(value: string): void;
  onPasswordChange(value: string): void;
  onSubmit(event?: { preventDefault(): void }): void;
  onSwitchMode(): void;
}

export function LoginScreen(props: LoginScreenProps) {
  return (
    <section className="auth-card auth-card--login">
      <div className="auth-card__badge">QQ经典农场</div>
      <h1>欢迎回来</h1>
      <p>登录后继续照看你的农场、好友和奖励进度。</p>
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
        <button type="submit" disabled={props.isSubmitting}>{props.isSubmitting ? '登录中...' : '登录'}</button>
      </form>
      <button type="button" className="auth-switch" onClick={props.onSwitchMode}>没有账号？去注册</button>
    </section>
  );
}
