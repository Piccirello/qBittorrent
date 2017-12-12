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

#include <QDebug>
#include <QDir>
#include <QDomDocument>
#include <QDomElement>
#include <QDomNode>
#include <QIODevice>
#include <QProcess>

#include "base/utils/fs.h"
#include "base/utils/misc.h"
#include "base/logger.h"
#include "base/preferences.h"
#include "base/profile.h"
#include "base/net/downloadmanager.h"
#include "base/net/downloadhandler.h"
#include "searchengineweb.h"

enum SearchResultColumn
{
    PL_DL_LINK,
    PL_NAME,
    PL_SIZE,
    PL_SEEDS,
    PL_LEECHS,
    PL_ENGINE_URL,
    PL_DESC_LINK,
    NB_PLUGIN_COLUMNS
};

const QHash<QString, QString> SearchEngineWeb::m_categoryNames = SearchEngineWeb::initializeCategoryNames();

SearchEngineWeb::SearchEngineWeb()
    : m_searchStopped(false)
{
    m_searchProcess = new QProcess(this);
    m_searchProcess->setEnvironment(QProcess::systemEnvironment());
    connect(m_searchProcess, &QProcess::readyReadStandardOutput, this, &SearchEngineWeb::readSearchOutput);
    connect(m_searchProcess, static_cast<void (QProcess::*)(int)>(&QProcess::finished), this, &SearchEngineWeb::processFinished);

    m_searchTimeout = new QTimer(this);
    m_searchTimeout->setSingleShot(true);
    connect(m_searchTimeout, &QTimer::timeout, this, &SearchEngineWeb::onTimeout);

    update();
}

SearchEngineWeb::~SearchEngineWeb()
{
    qDeleteAll(m_plugins.values());
    cancelSearch();
}

QStringList SearchEngineWeb::allPlugins() const
{
    return m_plugins.keys();
}

bool SearchEngineWeb::isActive() const
{
    return (m_searchProcess->state() != QProcess::NotRunning);
}

void SearchEngineWeb::startSearch(const QString &pattern, const QString &category, const QStringList &usedPlugins)
{
    // Search process already running or
    // No search pattern entered
    if ((m_searchProcess->state() != QProcess::NotRunning) || pattern.isEmpty()) {
        qDebug() << "searchFailed()";
        return;
    }

    // Reload environment variables (proxy)
    m_searchProcess->setEnvironment(QProcess::systemEnvironment());

    // clear all search results
    m_stdoutQueue.clear();

    QStringList params;
    m_searchStopped = false;
    params << Utils::Fs::toNativePath(engineLocation() + "/nova2.py");
    params << usedPlugins.join(",");
    params << category;
    params << pattern.split(" ");

    // Launch search
    m_searchProcess->start(Utils::Misc::pythonExecutable(), params, QIODevice::ReadOnly);
    m_searchTimeout->start(180000); // 3min
}

void SearchEngineWeb::cancelSearch()
{
    qDebug() << "Canceling the search";
    if (m_searchProcess->state() != QProcess::NotRunning) {
#ifdef Q_OS_WIN
        m_searchProcess->kill();
#else
        m_searchProcess->terminate();
#endif
        m_searchStopped = true;
        m_searchTimeout->stop();

        m_searchProcess->waitForFinished(1000);
    }
}

void SearchEngineWeb::downloadTorrent(const QString &siteUrl, const QString &url)
{
    QProcess *downloadProcess = new QProcess(this);
    downloadProcess->setEnvironment(QProcess::systemEnvironment());
    connect(downloadProcess, static_cast<void (QProcess::*)(int)>(&QProcess::finished), this, &SearchEngineWeb::torrentFileDownloadFinished);
    m_downloaders << downloadProcess;
    QStringList params {
        Utils::Fs::toNativePath(engineLocation() + "/nova2dl.py"),
        siteUrl,
        url
    };
    // Launch search
    downloadProcess->start(Utils::Misc::pythonExecutable(), params, QIODevice::ReadOnly);
}

void SearchEngineWeb::readSearchOutput()
{
    QByteArray output = m_searchProcess->readAllStandardOutput();
    output.replace("\r", "");

    foreach (const QByteArray &line, output.split('\n')) {
        SearchResult searchResult;
        if (parseSearchResult(QString::fromUtf8(line), searchResult))
            m_stdoutQueue.enqueue(searchResult);
    }
}

QList<SearchResult> SearchEngineWeb::readBufferedSearchOutput()
{
    int size = m_stdoutQueue.size();
    QList<SearchResult> searchResultList;
    // limit to 500 search results
    for(int i = 0; (i < size) && (i < 500); i++)
        searchResultList << m_stdoutQueue.dequeue();

    return searchResultList;
}

QString SearchEngineWeb::pluginsLocation()
{

    return QString("%1/engines").arg(engineLocation());
}

QString SearchEngineWeb::categoryFullName(const QString &categoryName)
{
    return tr(m_categoryNames.value(categoryName).toUtf8().constData());
}

QString SearchEngineWeb::engineLocation()
{
    QString folder = "nova";
    if (Utils::Misc::pythonVersion() >= 3)
        folder = "nova3";
    const QString location = Utils::Fs::expandPathAbs(specialFolderLocation(SpecialFolder::Data) + folder);
    QDir locationDir(location);
    if (!locationDir.exists())
        locationDir.mkpath(locationDir.absolutePath());
    return location;
}

// Slot called when QProcess is Finished
// QProcess can be finished for 3 reasons :
// Error | Stopped by user | Finished normally
void SearchEngineWeb::processFinished(int exitcode)
{
    m_searchTimeout->stop();

    if (exitcode == 0)
        qDebug() << "Search finished";
    else
        qDebug() << "Search failed";
}

void SearchEngineWeb::torrentFileDownloadFinished(int exitcode)
{
    QProcess *downloadProcess = static_cast<QProcess*>(sender());
    if (exitcode == 0) {
        QString line = QString::fromUtf8(downloadProcess->readAllStandardOutput()).trimmed();
        QStringList parts = line.split(' ');
        if (parts.size() == 2)
            emit torrentFileDownloaded(parts[0]);
    }

    qDebug() << "Deleting downloadProcess";
    m_downloaders.removeOne(downloadProcess);
    downloadProcess->deleteLater();
}

void SearchEngineWeb::onTimeout()
{
    cancelSearch();
}

void SearchEngineWeb::update()
{
    QProcess nova;
    nova.setEnvironment(QProcess::systemEnvironment());
    QStringList params;
    params << Utils::Fs::toNativePath(engineLocation() + "/nova2.py");
    params << "--capabilities";
    nova.start(Utils::Misc::pythonExecutable(), params, QIODevice::ReadOnly);
    nova.waitForStarted();
    nova.waitForFinished();

    QString capabilities = QString(nova.readAll());
    QDomDocument xmlDoc;
    if (!xmlDoc.setContent(capabilities)) {
        qWarning() << "Could not parse Nova search engine capabilities, msg: " << capabilities.toLocal8Bit().data();
        qWarning() << "Error: " << nova.readAllStandardError().constData();
        return;
    }

    QDomElement root = xmlDoc.documentElement();
    if (root.tagName() != "capabilities") {
        qWarning() << "Invalid XML file for Nova search engine capabilities, msg: " << capabilities.toLocal8Bit().data();
        return;
    }

    for (QDomNode engineNode = root.firstChild(); !engineNode.isNull(); engineNode = engineNode.nextSibling()) {
        QDomElement engineElem = engineNode.toElement();
        if (!engineElem.isNull()) {
            QString pluginName = engineElem.tagName();

            PluginInfo *plugin = new PluginInfo;
            plugin->name = pluginName;
            plugin->version = getPluginVersion(pluginPath(pluginName));
            plugin->fullName = engineElem.elementsByTagName("name").at(0).toElement().text();
            plugin->url = engineElem.elementsByTagName("url").at(0).toElement().text();

            foreach (QString cat, engineElem.elementsByTagName("categories").at(0).toElement().text().split(" ")) {
                cat = cat.trimmed();
                if (!cat.isEmpty())
                    plugin->supportedCategories << cat;
            }

            QStringList disabledEngines = Preferences::instance()->getSearchEngDisabled();
            plugin->enabled = !disabledEngines.contains(pluginName);

            // updateIconPath(plugin);

            if (!m_plugins.contains(pluginName)) {
                m_plugins[pluginName] = plugin;
                // emit pluginInstalled(pluginName);
            }
            else if (m_plugins[pluginName]->version != plugin->version) {
                delete m_plugins.take(pluginName);
                m_plugins[pluginName] = plugin;
                // emit pluginUpdated(pluginName);
            }
        }
    }
}

// Parse one line of search results list
// Line is in the following form:
// file url | file name | file size | nb seeds | nb leechers | Search engine url
bool SearchEngineWeb::parseSearchResult(const QString &line, SearchResult &searchResult)
{
    const QStringList parts = line.split("|");
    const int nbFields = parts.size();
    if (nbFields < (NB_PLUGIN_COLUMNS - 1)) return false; // -1 because desc_link is optional

    searchResult = SearchResult();
    searchResult.fileUrl = parts.at(PL_DL_LINK).trimmed(); // download URL
    searchResult.fileName = parts.at(PL_NAME).trimmed(); // Name
    searchResult.fileSize = parts.at(PL_SIZE).trimmed().toLongLong(); // Size
    bool ok = false;
    searchResult.nbSeeders = parts.at(PL_SEEDS).trimmed().toLongLong(&ok); // Seeders
    if (!ok || (searchResult.nbSeeders < 0))
        searchResult.nbSeeders = -1;
    searchResult.nbLeechers = parts.at(PL_LEECHS).trimmed().toLongLong(&ok); // Leechers
    if (!ok || (searchResult.nbLeechers < 0))
        searchResult.nbLeechers = -1;
    searchResult.siteUrl = parts.at(PL_ENGINE_URL).trimmed(); // Search site URL
    if (nbFields == NB_PLUGIN_COLUMNS)
        searchResult.descrLink = parts.at(PL_DESC_LINK).trimmed(); // Description Link

    return true;
}

QString SearchEngineWeb::pluginPath(const QString &name)
{
    return QString("%1/%2.py").arg(pluginsLocation()).arg(name);
}

QHash<QString, QString> SearchEngineWeb::initializeCategoryNames()
{
    QHash<QString, QString> result;

    result["all"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "All categories");
    result["movies"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Movies");
    result["tv"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "TV shows");
    result["music"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Music");
    result["games"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Games");
    result["anime"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Anime");
    result["software"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Software");
    result["pictures"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Pictures");
    result["books"] = QT_TRANSLATE_NOOP("SearchEngineWeb", "Books");

    return result;
}

PluginVersion SearchEngineWeb::getPluginVersion(QString filePath)
{
    QFile plugin(filePath);
    if (!plugin.exists()) {
        qDebug("%s plugin does not exist, returning 0.0", qUtf8Printable(filePath));
        return {};
    }

    if (!plugin.open(QIODevice::ReadOnly | QIODevice::Text))
        return {};

    const PluginVersion invalidVersion;

    PluginVersion version;
    while (!plugin.atEnd()) {
        QByteArray line = plugin.readLine();
        if (line.startsWith("#VERSION: ")) {
            line = line.split(' ').last().trimmed();
            version = PluginVersion::tryParse(line, invalidVersion);
            if (version == invalidVersion) {
                LogMsg(tr("Search plugin '%1' contains invalid version string ('%2')")
                    .arg(Utils::Fs::fileName(filePath)).arg(QString::fromUtf8(line)), Log::MsgType::WARNING);
            }
            else
                qDebug() << "plugin" << filePath << "version: " << version;
            break;
        }
    }
    return version;
}

QVariant SearchEngineWeb::fromValue(const SearchResult &result)
{
    QMap<QString, QVariant> resultMap;
    resultMap.insert("fileName", result.fileName);
    resultMap.insert("fileUrl", result.fileUrl);
    resultMap.insert("fileSize", result.fileSize);
    resultMap.insert("nbSeeders", result.nbSeeders);
    resultMap.insert("nbLeechers", result.nbLeechers);
    resultMap.insert("siteUrl", result.siteUrl);
    resultMap.insert("descrLink", result.descrLink);

    return QVariant(resultMap);
}
