import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * 404-sivu — näytetään, kun reittiä ei löydy.
 */
export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 text-5xl font-bold text-muted-foreground">
            404
          </div>
          <CardTitle>Sivua ei löytynyt</CardTitle>
          <CardDescription>
            Hakemaasi sivua ei ole olemassa tai se on siirretty toiseen
            osoitteeseen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tarkista osoite tai palaa etusivulle jatkamaan.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link to="/dashboard">Takaisin etusivulle</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
