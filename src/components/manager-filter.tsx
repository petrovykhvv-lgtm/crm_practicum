/** Фильтр «Ответственный» для форм поиска: все, мои (если выбран текущий менеджер), без ответственного, конкретный менеджер. */
export function ManagerFilter({ value, managers, hasCurrent, label = "Ответственный" }: { value?: string; managers: { id: string; name: string }[]; hasCurrent: boolean; label?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" name="manager" defaultValue={value ?? ""}>
        <option value="">Все</option>
        {hasCurrent && <option value="me">Мои</option>}
        <option value="none">Не назначен</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
