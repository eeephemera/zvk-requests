"use client";

type Props = {
  status: string;
  org: string;
  onChangeStatus: (v: string) => void;
  onChangeOrg: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export default function ManagerFilters({ status, org, onChangeStatus, onChangeOrg, onApply, onReset }: Props) {
  return (
    <div className="mb-6 flex flex-wrap gap-4 items-end">
      <div className="flex flex-col gap-2">
        <label className="text-xs text-discord-text-muted">Статус</label>
        <select 
          value={status}
          onChange={(e) => onChangeStatus(e.target.value)}
          className="discord-input"
        >
          <option value="">Все статусы</option>
          <option value="На рассмотрении">На рассмотрении</option>
          <option value="В работе">В работе</option>
          <option value="Одобрена">Одобрена</option>
          <option value="Отклонена">Отклонена</option>
          <option value="Завершена">Завершена</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-discord-text-muted">Организация</label>
        <input 
          type="text" 
          placeholder="Поиск по организации..."
          value={org}
          onChange={(e) => onChangeOrg(e.target.value)}
          className="discord-input"
        />
      </div>
      <div className="flex gap-2 ml-auto">
        <button onClick={onApply} className="discord-btn-primary">Применить</button>
        <button onClick={onReset} className="discord-btn-secondary">Сбросить</button>
      </div>
    </div>
  );
}


