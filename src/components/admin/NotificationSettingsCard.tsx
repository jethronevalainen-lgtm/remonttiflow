import { useEffect, useState } from 'react';
import { BellRing, Clock3, Save, TimerReset } from 'lucide-react';

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
  workOrderDueReminderDays: 1,
  workOrderOverdueRemindersEnabled: true,
  timezone: 'Europe/Helsinki',
};

function clamp(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
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
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function NotificationSettingsCard({
  organizationId,
  onSuccess,
  onError,
}: NotificationSettingsCardProps) {
  const [settings, setSettings] = useState<NotificationSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadNotificationSettings(organizationId)
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((caught) => {
        if (active) onError?.(caught instanceof Error ? caught.message : 'Ilmoitusasetusten haku epäonnistui.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [onError, organizationId]);

  const disabled = loading || saving || !settings.notificationCenterEnabled;

  const save = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(organizationId, settings);
      onSuccess?.('Ilmoitusasetukset tallennettiin. Muutokset tulevat voimaan viimeistään viiden minuutin kuluessa.');
    } catch (caught) {
      onError?.(caught instanceof Error ? caught.message : 'Ilmoitusasetusten tallennus epäonnistui.');
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
          Ilmoitukset muodostetaan palvelimella, joten ne syntyvät myös silloin, kun sovellus ei ole avoinna.
          Avoimet ilmoitukset näkyvät käyttäjän kellovalikossa.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingRow
          id="notification-center-enabled"
          title="Ilmoituskeskus käytössä"
          description="Poista valinta vain, jos kaikki automaattiset työvuoro- ja määräaikailmoitukset halutaan keskeyttää."
          checked={settings.notificationCenterEnabled}
          disabled={loading || saving}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, notificationCenterEnabled: checked }))}
        />

        <SettingRow
          id="late-check-in-alerts-enabled"
          title="Puuttuvan sisäänkirjautumisen ilmoitukset"
          description="Työntekijä saa muistutuksen ja hänen työnjohtajansa hälytyksen, kun työvuoron alusta ja sallitusta liukumasta on kulunut eikä kirjautumista löydy. Hyväksytty poissaolo estää ilmoituksen."
          checked={settings.lateCheckInAlertsEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, lateCheckInAlertsEnabled: checked }))}
        >
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="late-check-in-grace" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <TimerReset size={14} /> Sallittu liukuma
            </Label>
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
              <span className="text-sm text-slate-500">minuuttia</span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          id="shift-start-reminders-enabled"
          title="Työvuoron alkamismuistutus"
          description="Työntekijälle muistutetaan tulevasta työvuorosta ennen sen alkua. Muistutus poistuu, kun työvuoro alkaa tai työntekijä kirjautuu sisään."
          checked={settings.shiftStartRemindersEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, shiftStartRemindersEnabled: checked }))}
        >
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="shift-start-reminder" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Clock3 size={14} /> Muistuta ennen alkua
            </Label>
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
              <span className="text-sm text-slate-500">minuuttia</span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          id="work-order-due-reminders-enabled"
          title="Työmääräyksen määräaikamuistutus"
          description="Työmääräykseen nimetyt työntekijät tai projektitiimi saavat muistutuksen ennen määräpäivää."
          checked={settings.workOrderDueRemindersEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, workOrderDueRemindersEnabled: checked }))}
        >
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="work-order-due-days" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Muistuta ennen määräpäivää
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="work-order-due-days"
                type="number"
                min={0}
                max={30}
                step={1}
                value={settings.workOrderDueReminderDays}
                disabled={disabled || !settings.workOrderDueRemindersEnabled}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  workOrderDueReminderDays: clamp(event.target.value, 0, 30, previous.workOrderDueReminderDays),
                }))}
              />
              <span className="text-sm text-slate-500">päivää</span>
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
