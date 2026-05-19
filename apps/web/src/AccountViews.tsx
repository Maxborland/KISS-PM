import { type WorkspaceUser } from "./api";
import { type WorkspaceData } from "./workspaceData";
import { useProfileMutation, useThemeMutation } from "./workspaceQueries";
import { getErrorMessage, hasPermission } from "./workspaceShellState";
import { Panel, StatusPill } from "./components/workspace-ui";

export function ProfileView(props: {
  data: WorkspaceData;
  onChanged: (message: string) => void;
}) {
  const canUpdate = hasPermission(props.data.permissions, "profile.update");
  const profileMutation = useProfileMutation();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await profileMutation.mutateAsync({
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      telegram: String(form.get("telegram"))
    });
    props.onChanged("Профиль обновлен");
  }

  return (
    <Panel
      title="Профиль пользователя"
      subtitle="Поля текущего пользователя без tenant-management слоя."
    >
      <div className="settings-layout">
        <form className="stack-form settings-form" onSubmit={submit}>
          <label>
            Имя
            <input name="name" defaultValue={props.data.me.name} disabled={!canUpdate} />
          </label>
          <label>
            Телефон
            <input name="phone" defaultValue={props.data.me.phone ?? ""} disabled={!canUpdate} />
          </label>
          <label>
            Telegram
            <input name="telegram" defaultValue={props.data.me.telegram ?? ""} disabled={!canUpdate} />
          </label>
          {profileMutation.error ? (
            <p className="error">{getErrorMessage(profileMutation.error)}</p>
          ) : null}
          {canUpdate ? (
            <button className="primary-button" disabled={profileMutation.isPending} type="submit">
              Сохранить профиль
            </button>
          ) : (
            <p className="muted">Профиль доступен только для просмотра.</p>
          )}
        </form>
        <aside className="settings-aside">
          <div className="profile-preview">
            <span className="avatar large">{props.data.me.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{props.data.me.name}</strong>
              <small>{props.data.me.email}</small>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Должность</dt>
              <dd>{props.data.me.positionName ?? "Без должности"}</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>
                <StatusPill
                  tone={props.data.me.status === "active" ? "success" : "muted"}
                  label={props.data.me.status === "active" ? "Активен" : "Отключен"}
                />
              </dd>
            </div>
            <div>
              <dt>Права</dt>
              <dd>{props.data.permissions.length}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Panel>
  );
}

export function ThemeView(props: {
  user: WorkspaceUser;
  onChanged: (message: string) => void;
}) {
  const themeMutation = useThemeMutation();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await themeMutation.mutateAsync({
      theme: String(form.get("theme")),
      accentColor: String(form.get("accentColor"))
    });
    props.onChanged("Тема обновлена");
  }

  return (
    <Panel
      title="Оформление"
      subtitle="Личная настройка темы и акцента для рабочего интерфейса."
    >
      <div className="settings-layout">
        <form className="stack-form settings-form" onSubmit={submit}>
          <label>
            Тема
            <select name="theme" defaultValue={props.user.theme}>
              <option value="light">Светлая</option>
              <option value="dark">Темная</option>
            </select>
          </label>
          <label>
            Акцентный цвет
            <input name="accentColor" defaultValue={props.user.accentColor} type="color" />
          </label>
          {themeMutation.error ? (
            <p className="error">{getErrorMessage(themeMutation.error)}</p>
          ) : null}
          <button className="primary-button" disabled={themeMutation.isPending} type="submit">
            Применить тему
          </button>
        </form>
        <aside
          className="theme-preview"
          style={{ "--preview-accent": props.user.accentColor } as React.CSSProperties}
        >
          <div className="theme-preview-topbar">
            <span />
            <span />
            <span />
          </div>
          <div className="theme-preview-body">
            <strong>KISS PM</strong>
            <p>Плотная рабочая поверхность с выбранным акцентом.</p>
            <span className="preview-accent-line" />
          </div>
        </aside>
      </div>
    </Panel>
  );
}
