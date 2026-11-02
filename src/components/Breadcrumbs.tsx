import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  path: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="py-2.5 px-1 overflow-x-auto"
      itemScope
      itemType="https://schema.org/BreadcrumbList"
    >
      <ol className="flex items-center gap-1.5 text-xs text-[#7c5c63] whitespace-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={index}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              className="flex items-center gap-1.5"
            >
              {index > 0 && <ChevronRight className="w-3 h-3 text-[#d19ca7] shrink-0" />}
              {isLast ? (
                <span
                  itemProp="name"
                  className="font-medium text-[#2d1e21] truncate max-w-[200px] sm:max-w-none"
                  aria-current="page"
                >
                  {item.name}
                </span>
              ) : (
                <button
                  type="button"
                  itemProp="item"
                  onClick={item.onClick}
                  className="hover:text-[#9e5461] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {index === 0 && <Home className="w-3 h-3 shrink-0" />}
                  <span itemProp="name">{item.name}</span>
                </button>
              )}
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
