import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAddPlantFlow } from './AddPlantFlowContext';
import { registrationResumeScreen } from './registrationStorage';

type Props = {
  navigationRef: { current: { navigate: (name: string, params: object) => void } | null };
  ready: boolean;
};

export default function RegistrationNotificationListener({ navigationRef, ready }: Props) {
  const { draft, scope } = useAddPlantFlow();
  const latest = useRef({ draft, scope });
  latest.current = { draft, scope };
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!alive || !response) return;
      const request = response.notification.request;
      const data = request.content.data ?? {};
      const current = latest.current;
      if (data.kind !== 'CHARACTER_READY' || data.scope !== current.scope
        || data.jobId !== current.draft.generationJobId || current.draft.createdPlantId
        || handled.current.has(request.identifier)) return;
      if (!navigationRef.current) return;
      handled.current.add(request.identifier);
      const screen = registrationResumeScreen(current.draft);
      navigationRef.current.navigate('AddPlant', {
        screen, params: screen === 'CharacterResult' ? { resumeGeneration: 'true' } : undefined,
      });
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // A cold start may happen before the response listener has been mounted.
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    return () => { alive = false; sub.remove(); };
  }, [ready, navigationRef]);
  return null;
}
