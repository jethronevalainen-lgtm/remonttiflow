import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Sovellustason virheraja (Error Boundary).
 *
 * Ottaa kiinni lapsikomponenteissa tapahtuvat renderöintivirheet ja
 * näyttää käyttäjälle suomenkielisen varakäyttöliittymän, josta voi
 * joko yrittää uudelleen tai ladata koko sivun uudelleen.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Käsittelemätön virhe käyttöliittymässä', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md" role="alert">
            <CardHeader>
              <CardTitle>Jokin meni pieleen</CardTitle>
              <CardDescription>
                Sovelluksessa tapahtui odottamaton virhe. Voit yrittää
                uudelleen tai ladata sivun uudelleen. Jos ongelma jatkuu,
                ota yhteyttä tukeen.
              </CardDescription>
            </CardHeader>
            {import.meta.env.DEV && this.state.error && (
              <CardContent>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  {this.state.error.message}
                </pre>
              </CardContent>
            )}
            <CardFooter className="flex gap-3">
              <Button onClick={this.handleRetry}>Yritä uudelleen</Button>
              <Button variant="outline" onClick={this.handleReload}>
                Lataa sivu uudelleen
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
