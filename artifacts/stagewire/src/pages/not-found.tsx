import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import ActiveCallPage from '@/pages/active-call';

export default function NotFound() {
  // V1.4 bridge: the current app router still lives in the legacy single-file
  // App.tsx. Keep that stable while we extract screens, but make the new
  // worker-first Active Call route live immediately.
  if (/^\/workday\/\d+\/?$/.test(window.location.pathname)) {
    return <ActiveCallPage />;
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
