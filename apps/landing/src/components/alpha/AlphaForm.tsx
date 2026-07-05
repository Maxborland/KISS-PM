import { useState } from "react";

type FormMode = "empty" | "error" | "success";

interface AlphaFormValues {
  name: string;
  email: string;
  company: string;
  role: string;
  projects: string;
  manualWork: string;
}

const initialValues: AlphaFormValues = {
  name: "",
  email: "",
  company: "",
  role: "",
  projects: "",
  manualWork: "",
};

const projectOptions = ["До 5", "5-15", "15-30", "30-50", "50+"];

export function AlphaForm({ mode = "empty" }: { mode?: FormMode }) {
  const [values, setValues] = useState<AlphaFormValues>(initialValues);
  const [submitted, setSubmitted] = useState(mode === "success");
  const [showErrors, setShowErrors] = useState(mode === "error");

  function updateField(field: keyof AlphaFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const requiredFilled = values.name && values.email && values.company && values.role && values.projects;

    if (!requiredFilled) {
      setShowErrors(true);
      setSubmitted(false);
      return;
    }

    setShowErrors(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="alpha-form alpha-form--success">
        <span className="alpha-kicker">Заявка</span>
        <h3>Спасибо.</h3>
        <p>Мы получили заявку и свяжемся с вами, когда будем готовы показать закрытую альфу.</p>
        <small>Локальное demo-состояние: форма не отправляет данные на сервер.</small>
      </div>
    );
  }

  return (
    <form className="alpha-form" onSubmit={handleSubmit} noValidate>
      <div className="alpha-form__grid">
        <label>
          <span>Имя</span>
          <input value={values.name} onChange={(event) => updateField("name", event.target.value)} required />
          {showErrors && !values.name ? <small>Укажите имя.</small> : null}
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
          />
          {showErrors && !values.email ? <small>Укажите email.</small> : null}
        </label>
        <label>
          <span>Компания</span>
          <input value={values.company} onChange={(event) => updateField("company", event.target.value)} required />
          {showErrors && !values.company ? <small>Укажите компанию.</small> : null}
        </label>
        <label>
          <span>Роль</span>
          <input value={values.role} onChange={(event) => updateField("role", event.target.value)} required />
          {showErrors && !values.role ? <small>Укажите роль.</small> : null}
        </label>
      </div>
      <label>
        <span>Сколько проектов идет параллельно?</span>
        <select value={values.projects} onChange={(event) => updateField("projects", event.target.value)} required>
          <option value="">Выберите диапазон</option>
          {projectOptions.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        {showErrors && !values.projects ? <small>Выберите диапазон.</small> : null}
      </label>
      <label>
        <span>Где сейчас сильнее всего ручной труд?</span>
        <textarea
          value={values.manualWork}
          onChange={(event) => updateField("manualWork", event.target.value)}
          rows={4}
        />
      </label>
      <div className="alpha-form__footer">
        <button className="alpha-btn alpha-btn--dark" type="submit">
          Запросить доступ
        </button>
        <small>Preview submission: заявка останется только в локальном demo-состоянии.</small>
      </div>
    </form>
  );
}
