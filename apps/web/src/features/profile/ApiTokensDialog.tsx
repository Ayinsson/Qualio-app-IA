import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { createApiToken, listApiTokens, revokeApiToken } from '../../lib/apiTokens';
import { useToast } from '../../ui';
import { ApiTokensModal } from './ApiTokensModal';

// Conecta el modal de tokens de API con la API y los avisos.
export function ApiTokensDialog({ accessToken, onClose }: { accessToken: string | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['api-tokens', accessToken];

  const tokensQuery = useQuery({
    queryKey,
    queryFn: () => listApiTokens(accessToken as string),
    enabled: Boolean(accessToken),
  });

  const requireToken = () => {
    if (!accessToken) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    }
    return accessToken;
  };

  return (
    <ApiTokensModal
      tokens={tokensQuery.data}
      loading={tokensQuery.isLoading}
      loadError={tokensQuery.isError}
      onRetry={() => tokensQuery.refetch()}
      apiBaseUrl={api.defaults.baseURL ?? ''}
      onClose={onClose}
      onCreate={async (payload) => {
        try {
          const created = await createApiToken(requireToken(), payload);
          await queryClient.invalidateQueries({ queryKey });
          return created;
        } catch (error) {
          toast(getApiErrorMessage(error), 'error');
          throw error;
        }
      }}
      onRevoke={async (tokenId) => {
        try {
          await revokeApiToken(requireToken(), tokenId);
          await queryClient.invalidateQueries({ queryKey });
          toast('Token revocado.');
        } catch (error) {
          toast(getApiErrorMessage(error), 'error');
          throw error;
        }
      }}
    />
  );
}
