import { Navigate, useParams } from 'react-router-dom';

export default function CustomerOrderDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const target = requestId
    ? `/tilaajan-tyot?order=${encodeURIComponent(requestId)}`
    : '/tilaajan-tyot';

  return <Navigate to={target} replace />;
}
