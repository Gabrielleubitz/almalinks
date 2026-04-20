import type { UserCard } from '../types/user';

type SortableMember = Pick<UserCard, 'displayName' | 'firstName' | 'lastName' | 'name' | 'uid'>;

export function displayNameSortKey(card: SortableMember): string {
  const n =
    (card.displayName && card.displayName.trim()) ||
    `${card.firstName || ''} ${card.lastName || ''}`.trim() ||
    (card.name && String(card.name).trim()) ||
    card.uid;
  return n.toLocaleLowerCase();
}

export function compareMembersByDisplayName(a: SortableMember, b: SortableMember): number {
  return displayNameSortKey(a).localeCompare(displayNameSortKey(b), undefined, { sensitivity: 'base' });
}
