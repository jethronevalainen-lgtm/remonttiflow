import { useEffect, useRef, useState } from 'react';
import { BellRing, CalendarClock, Clock3, Save, TimerReset } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '@/lib/supabase/appNotifications';

interface NotificationSettingsCardProps {
  organizationId: string;
  compact?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const EMPTY_SETTINGS: NotificationSettings = {
  notificationCenterEnabled: true,
  lateCheckInAlertsEnabled: true,
  lateCheckInGraceMinutes: 15,
  shiftStartRemindersEnabled: true,
  shiftStartReminderMinutes: 30,
  workOrderDueRemindersEnabled: true,
  workOrderDueReminderDays: 7,
  workOrderOverdueRemindersEnabled: true,
  timezone: 'Europe/Helsinki',
};

const GRACE_PRESETS = [
  { value: 0, label: 'Ei liukumaa' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 90, label: '1 h 30 min' },
  { value: 120, label: '2 h' },
];

const SHIFT_REMINDER_PRESETS = [
  { value: 15, label: '15 min ennen' },
  { value: 30, label: '30 min ennen' },
  { value: 60, label: '1 h ennen' },
  { value: 120, label: '2 h ennen' },
  { value: 240, label: '4 h ennen' },
];

const DUE_REMINDER_PRESETS = [
  { value: 0, label: 'Määräpäivänä' },
  { value: 1, label: '1 päivä ennen' },
  { value: 2, label: '2 päivää ennen' },
  { value: 3, label: '3 päivää ennen' },
  { value: 7, label: '1 viikko ennen' },
  { value: 14, label: '2 viikkoa ennen' },
  { value: 30, label: '1 kuukausi ennen' },
];

function clamp(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function PresetButtons({
  value,
  options,
  disabled,
  onChange,
}: {
  value: number;
  options: Array<{ value: number; label: string }>;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Valmiit aikavaihtoehdot">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function SettingRow({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  children,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-semibold text-slate-900">{title}</Label>
          <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
        </div>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={title}
        />
      </div>
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function NotificationSettingsCard({
  organizationId,
  compact = false,
  onSuccess,
  onError,
}: NotificationSettingsCardProps) {
  const [settings, setSettings] = useState<NotificationSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadNotificationSettings(organizationId)
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((caught) => {
        if (active) onErrorRef.current?.(caught instanceof Error ? caught.message : 'Ilmoitusasetusten haku epäonnistui.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [organizationId]);

  const disabled = loading || saving || !settings.notificationCenterEnabled;

  const save = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(organizationId, settings);
      onSuccessRef.current?.('Ilmoitusasetukset tallennettiin. Muutokset tulevat voimaan viimeistään viiden minuutin kuluessa.');
    } catch (caught) {
      onErrorRef.current?.(caught instanceof Error ? caught.message : 'Ilmoitusasetusten tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing size={19} className="text-primary" />
          Automaattiset ilmoitukset
        </CardTitle>
        <p className="text-sm leading-6 text-slate-600">
          Ylläpitäjä tai työnjohtaja määrittää organisaation yhteiset ilmoitusajat. Ilmoitukset muodostetaan
          palvelimella myös silloin, kun sovellus ei ole avoinna.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <SettingRow
            id="notification-center-enabled"
            title="Ilmoituskeskus käytössä"
            description="Poista valinta vain, jos kaikki automaattiset työvuoro- ja määräaikailmoitukset halutaan keskeyttää."
            checked={settings.notificationCenterEnabled}
            disabled={loading || saving}
            onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, notificationCenterEnabled: checked }))}
          />
        )}

        <SettingRow
          id="late-check-in-alerts-enabled"
          title="Puuttuvan sisäänkirjautumisen ilmoitukset"
          description="Työntekijä saa muistutuksen ja hänen työnjohtajansa hälytyksen vasta valitun liukuman jälkeen. Nolla tarkoittaa, ettei myöhästymiselle sallita liukumaa. Hyväksytty poissaolo estää ilmoituksen."
          checked={settings.lateCheckInAlertsEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, lateCheckInAlertsEnabled: checked }))}
        >
          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <TimerReset size={14} /> Työmaalle saapumisen sallittu liukuma
          </Label>
          <PresetButtons
            value={settings.lateCheckInGraceMinutes}
            options={GRACE_PRESETS}
            disabled={disabled || !settings.lateCheckInAlertsEnabled}
            onChange={(lateCheckInGraceMinutes) => setSettings((previous) => ({ ...previous, lateCheckInGraceMinutes }))}
          />
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="late-check-in-grace" className="text-xs text-slate-500">Muu liukuma, 0–240 minuuttia</Label>
            <div className="flex items-center gap-2">
              <Input
                id="late-check-in-grace"
                type="number"
                min={0}
                max={240}
                step={5}
                value={settings.lateCheckInGraceMinutes}
                disabled={disabled || !settings.lateCheckInAlertsEnabled}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  lateCheckInGraceMinutes: clamp(event.target.value, 0, 240, previous.lateCheckInGraceMinutes),
                }))}
              />
              <span className="text-sm text-slate-500">min</span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          id="shift-start-reminders-enabled"
          title="Työvuoron alkamismuistutus"
          description="Työntekijälle muistutetaan tulevasta työvuorosta ennen sen alkua. Tämä asetus käsitellään tunteina ja minuutteina, koska kyse on työpäivän alkamisesta."
          checked={settings.shiftStartRemindersEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, shiftStartRemindersEnabled: checked }))}
        >
          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock3 size={14} /> Muistuta ennen työvuoron alkua
          </Label>
          <PresetButtons
            value={settings.shiftStartReminderMinutes}
            options={SHIFT_REMINDER_PRESETS}
            disabled={disabled || !settings.shiftStartRemindersEnabled}
            onChange={(shiftStartReminderMinutes) => setSettings((previous) => ({ ...previous, shiftStartReminderMinutes }))}
          />
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="shift-start-reminder" className="text-xs text-slate-500">Muu aika, 0–240 minuuttia</Label>
            <div className="flex items-center gap-2">
              <Input
                id="shift-start-reminder"
                type="number"
                min={0}
                max={240}
                step={5}
                value={settings.shiftStartReminderMinutes}
                disabled={disabled || !settings.shiftStartRemindersEnabled}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  shiftStartReminderMinutes: clamp(event.target.value, 0, 240, previous.shiftStartReminderMinutes),
                }))}
              />
              <span className="text-sm text-slate-500">min</span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          id="work-order-due-reminders-enabled"
          title="Työmääräyksen määräaikamuistutus"
          description="Työmääräysten ennakointi määritetään päivinä. Valitse esimerkiksi kaksi päivää, viikko tai kaksi viikkoa ennen määräpäivää."
          checked={settings.workOrderDueRemindersEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, workOrderDueRemindersEnabled: checked }))}
        >
          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CalendarClock size={14} /> Ennakkomuistutuksen ajankohta
          </Label>
          <PresetButtons
            value={settings.workOrderDueReminderDays}
            options={DUE_REMINDER_PRESETS}
            disabled={disabled || !settings.workOrderDueRemindersEnabled}
            onChange={(workOrderDueReminderDays) => setSettings((previous) => ({ ...previous, workOrderDueReminderDays }))}
          />
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="work-order-due-days" className="text-xs text-slate-500">Muu aika, 0–90 päivää ennen</Label>
            <div className="flex items-center gap-2">
              <Input
                id="work-order-due-days"
                type="number"
                min={0}
                max={90}
                step={1}
                value={settings.workOrderDueReminderDays}
                disabled={disabled || !settings.workOrderDueRemindersEnabled}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  workOrderDueReminderDays: clamp(event.target.value, 0, 90, previous.workOrderDueReminderDays),
                }))}
              />
              <span className="text-sm text-slate-500">päivää ennen</span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          id="work-order-overdue-reminders-enabled"
          title="Myöhässä olevan työmääräyksen ilmoitus"
          description="Avoin ilmoitus säilyy työntekijän kellovalikossa, kunnes työmääräys valmistuu, perutaan tai määräpäivä siirretään."
          checked={settings.workOrderOverdueRemindersEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, workOrderOverdueRemindersEnabled: checked }))}
        />

        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Aikavyöhyke: {settings.timezone}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Työvuorojen ja määräpäivien tarkistus tehdään organisaation aikavyöhykkeellä.</p>
          </div>
          <Button onClick={() => void save()} disabled={loading || saving} className="gap-2 sm:min-w-44">
            <Save size={16} /> {saving ? 'Tallennetaan…' : 'Tallenna ilmoitukset'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
