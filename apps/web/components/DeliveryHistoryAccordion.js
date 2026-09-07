'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { BedIcon, BathIcon, ChevronIcon, BackArrowIcon, ExternalLinkIcon, HomeIcon } from '@/components/ui/icons';

const SKIP_REASON_LABEL = { no_matches: 'No matches', unsubscribed: 'Unsubscribed', cap_reached: 'Cap reached' };
const STATUS_TONE = { failed: 'danger', skipped: 'neutral', pending: 'copper' };

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPrice(price) {
  if (price == null) return '—';
  return price.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatAddress(address) {
  if (!address) return 'Address unavailable';
  return [address.line1, address.city, address.state].filter(Boolean).join(', ');
}

function ListingDetail({ listing, onBack }) {
  return (
    <div className="p-4">
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-medium text-verdigris-dark hover:underline">
        <BackArrowIcon className="h-3.5 w-3.5" /> Back to listings
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-base font-semibold text-ink">{formatAddress(listing.address)}</div>
          <div className="mt-1 font-mono text-lg text-verdigris-dark">{formatPrice(listing.price)}</div>
          <div className="mt-2 flex items-center gap-4 text-sm text-slate">
            <span className="flex items-center gap-1">
              <BedIcon className="h-4 w-4" /> {listing.bedrooms ?? '—'}
            </span>
            <span className="flex items-center gap-1">
              <BathIcon className="h-4 w-4" /> {listing.bathrooms ?? '—'}
            </span>
          </div>
          {listing.listingUrl ? (
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-verdigris-dark hover:underline"
            >
              View listing <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded border border-line bg-paper">
          {listing.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate">
              <HomeIcon className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccordionItem({ delivery }) {
  const [open, setOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const listings = delivery.listingIds || [];
  const canExpand = delivery.status === 'sent' && listings.length > 0;

  function toggle() {
    if (!canExpand) return;
    setOpen((o) => !o);
    setSelectedListing(null);
  }

  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-4 px-5 py-3 text-left ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div>
          <div className="text-sm font-medium text-ink">
            {formatDate(delivery.sentAt || delivery.createdAt)}
            {canExpand ? ` · ${listings.length} listing${listings.length === 1 ? '' : 's'} sent` : ''}
          </div>
          {!canExpand ? (
            <div className="mt-1">
              <Badge tone={STATUS_TONE[delivery.status] || 'neutral'}>{SKIP_REASON_LABEL[delivery.skipReason] || delivery.status}</Badge>
            </div>
          ) : null}
        </div>
        {canExpand ? <ChevronIcon open={open} className="h-4 w-4 shrink-0 text-slate" /> : null}
      </button>

      {open && canExpand ? (
        <div className="border-t border-line bg-paper/40">
          {selectedListing ? (
            <ListingDetail listing={selectedListing} onBack={() => setSelectedListing(null)} />
          ) : (
            <div>
              {listings.map((listing) => (
                <div key={listing._id} className="flex items-center justify-between gap-4 border-b border-line px-5 py-2.5 last:border-0">
                  <button
                    onClick={() => setSelectedListing(listing)}
                    className="truncate text-left text-sm text-verdigris-dark hover:underline"
                  >
                    {formatAddress(listing.address)}
                  </button>
                  <button
                    onClick={() => setSelectedListing(listing)}
                    className="shrink-0 text-xs font-medium text-verdigris-dark hover:underline"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DeliveryHistoryAccordion({ deliveries }) {
  if (deliveries.length === 0) {
    return <p className="p-5 text-sm text-slate">No listings have been sent to this buyer yet.</p>;
  }
  return (
    <div>
      {deliveries.map((delivery) => (
        <AccordionItem key={delivery._id} delivery={delivery} />
      ))}
    </div>
  );
}
