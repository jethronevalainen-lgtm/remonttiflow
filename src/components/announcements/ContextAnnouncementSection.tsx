import AnnouncementSection from './AnnouncementCards';

function projectIdFromPath(pathname: string): string | undefined {
  const internal = pathname.match(/^\/projektit\/([^/]+)(?:\/|$)/);
  if (internal?.[1]) return decodeURIComponent(internal[1]);
  const customer = pathname.match(/^\/tilaajan-projektit\/([^/]+)(?:\/|$)/);
  return customer?.[1] ? decodeURIComponent(customer[1]) : undefined;
}

export default function ContextAnnouncementSection({ pathname }: { pathname: string }) {
  const projectId = projectIdFromPath(pathname);
  if (projectId) {
    return (
      <AnnouncementSection
        placement="project"
        projectId={projectId}
        title="Projektin tiedotteet"
        description="Tähän projektiin liittyvät ja sinulle kohdistetut voimassa olevat tiedotteet."
        compact
        className="mx-auto mb-5 max-w-[1700px]"
      />
    );
  }

  if (pathname === '/tyomaaraykset' || pathname.startsWith('/tyomaaraykset/')) {
    return (
      <AnnouncementSection
        placement="work_order"
        title="Työmääräysten tiedotteet"
        description="Omiin tai hallinnoimiisi työmääräyksiin liittyvät voimassa olevat tiedotteet."
        compact
        className="mx-auto mb-5 max-w-[1700px]"
      />
    );
  }

  return null;
}
