/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2015  Vladimir Golovnev <glassez@yandex.ru>
 * Copyright (C) 2006  Christophe Dumez <chris@qbittorrent.org>
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

#ifndef SEARCHENGINEWEB_H
#define SEARCHENGINEWEB_H

#include <QDebugStateSaver>
#include <QHash>
#include <QList>
#include <QMetaType>
#include <QObject>
#include <QQueue>
#include <QVariant>

#include "base/utils/version.h"

class QProcess;
class QTimer;

using PluginVersion = Utils::Version<unsigned short, 2>;
Q_DECLARE_METATYPE(PluginVersion)

struct PluginInfo
{
    QString name;
    PluginVersion version;
    QString fullName;
    QString url;
    QStringList supportedCategories;
    QString iconPath;
    bool enabled;
};

struct SearchResult
{
    QString fileName;
    QString fileUrl;
    qlonglong fileSize;
    qlonglong nbSeeders;
    qlonglong nbLeechers;
    QString siteUrl;
    QString descrLink;
};
Q_DECLARE_METATYPE(SearchResult)

class SearchEngineWeb: public QObject
{
    Q_OBJECT

public:
    SearchEngineWeb();
    ~SearchEngineWeb();

    QStringList allPlugins() const;
    bool isActive() const;

    void startSearch(const QString &pattern, const QString &category, const QStringList &usedPlugins);
    void cancelSearch();
    void downloadTorrent(const QString &siteUrl, const QString &url);
    void readSearchOutput();
    QList<SearchResult> readBufferedSearchOutput();

    static PluginVersion getPluginVersion(QString filePath);
    static QString categoryFullName(const QString &categoryName);
    static QString pluginsLocation();

    QVariant fromValue(const SearchResult &result);

signals:
    void torrentFileDownloaded(const QString &path);

private slots:
    void onTimeout();
    void processFinished(int exitcode);
    void torrentFileDownloadFinished(int exitcode);

private:
    void update();
    bool parseSearchResult(const QString &line, SearchResult &searchResult);

    static QString engineLocation();
    static QString pluginPath(const QString &name);
    static QHash<QString, QString> initializeCategoryNames();

    static const QHash<QString, QString> m_categoryNames;

    QHash<QString, PluginInfo*> m_plugins;
    QProcess *m_searchProcess;
    bool m_searchStopped;
    QTimer *m_searchTimeout;
    QList<QProcess*> m_downloaders;
    QQueue<SearchResult> m_stdoutQueue;
};

inline QDebug &operator<<(QDebug &debug, const SearchResult &result)
{
    QDebugStateSaver saver(debug);
    debug.nospace() << result.fileSize << ", " << result.fileName;
    return debug.space();
}

#endif // SEARCHENGINEWEB_H
