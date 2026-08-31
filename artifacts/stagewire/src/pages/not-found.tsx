import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import ActiveCallPage from '@/pages/active-call';
import SmartFinishCallPage from '@/pages/smart-finish-call';

export default function NotFound() {
  // V1.4 bridge: keep the legacy router stable while worker-first screens are
  // extracted into focused page modules.
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const appPath = base && window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || '/'
    : window.location.pathname;

  if (/^\/workday\/\d+\/?$/.test(appPath)) {
    return <ActiveCallPage />;
  }

  if (/^\/closeout\/\d+\/?$/.test(appPath)) {
    return <SmartFinishCallPage />;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">That StageWire screen does not exist yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
