/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2024 Thomas Piccirello <thomas@piccirello.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * In addition, as a special exception, the copyright holders give permission to
 * link this program with the OpenSSL project's "OpenSSL" library (or with
 * modified versions of it that use the same license as the "OpenSSL" library),
 * and distribute the linked executables. You must obey the GNU General Public
 * License in all respects for all of the code used other than "OpenSSL".  If you
 * modify file(s), you may extend this exception to your version of the file(s),
 * but you are not obligated to do so. If you do not wish to do so, delete this
 * exception statement from your version.
 */

#include "torrentsourcecache.h"

#include <QtAssert>

std::optional<BitTorrent::InfoHash> TorrentSourceCache::get(const QString &source)
{
    if (const auto iter = m_torrentSource.constFind(source); iter != m_torrentSource.constEnd())
        return iter.value();
    else
        return std::nullopt;
}

bool TorrentSourceCache::contains(const QString &source) const
{
    return m_torrentSource.contains(source) || m_torrentSourcesWithoutInfoHash.contains(source);
}

void TorrentSourceCache::add(const QString &source)
{
    m_torrentSourcesWithoutInfoHash.insert(source);
}

void TorrentSourceCache::update(const QString &source, const BitTorrent::InfoHash &infoHash)
{
    Q_ASSERT(infoHash != BitTorrent::InfoHash {});

    if (m_torrentSourcesWithoutInfoHash.contains(source))
    {
        m_torrentSource.insert(source, infoHash);
        m_torrentSourcesWithoutInfoHash.remove(source);
    }
}

void TorrentSourceCache::remove(const QString &source)
{
    m_torrentSource.remove(source);
    m_torrentSourcesWithoutInfoHash.remove(source);
}