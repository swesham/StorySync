import re
from collections import Counter, defaultdict

from users.models import Friendship
from .models import BookShelfItem, MovieShelfItem, PodcastShelfItem
from .services import GoogleBooksService, TMDbService, ListenNotesService

_STOPWORDS = frozenset(
    "the and for that this with from have been was were are but not you all can her "
    "his how its our out day get use man new now way may say she two who boy did "
    "has had him his let put say too old any own".split()
)

_TMDB_ALIASES = {
    "sci-fi": "science fiction",
    "scifi": "science fiction",
    "fiction": "drama",
    "young adult": "drama",
    "self-help": "documentary",
    "biography": "history",
    "poetry": "drama",
}


def _friend_ids(user):
    ids = set()
    for pk in Friendship.objects.filter(user1=user).values_list("user2_id", flat=True):
        ids.add(pk)
    for pk in Friendship.objects.filter(user2=user).values_list("user1_id", flat=True):
        ids.add(pk)
    return ids


def _safe_year(value):
    if not value:
        return None
    s = str(value)
    return int(s[:4]) if len(s) >= 4 and s[:4].isdigit() else None


def _tokenize_titles(title_list):
    c = Counter()
    for t in title_list:
        if not t:
            continue
        for w in re.findall(r"[a-zA-Z]{3,}", str(t).lower()):
            if w not in _STOPWORDS:
                c[w] += 1
    return [w for w, _ in c.most_common(10)]


def _preference_labels(user):
    return [x.strip() for x in (user.interests or []) if isinstance(x, str) and x.strip()]


def _genres_keywords_from_shelf_types(user, include):
    """Pull genre weights and title tokens from only the shelf types you ask for."""
    gw = defaultdict(float)
    titles = []
    if "book" in include:
        for row in BookShelfItem.objects.filter(user=user).only("genres", "title"):
            titles.append(row.title)
            for g in row.genres or []:
                s = str(g).strip()
                if s:
                    gw[s] += 1.0
    if "movie" in include:
        for row in MovieShelfItem.objects.filter(user=user).only("genres", "title"):
            titles.append(row.title)
            for g in row.genres or []:
                s = str(g).strip()
                if s:
                    gw[s] += 1.0
    if "podcast" in include:
        for row in PodcastShelfItem.objects.filter(user=user).only("genres", "title"):
            titles.append(row.title)
            for g in row.genres or []:
                s = str(g).strip()
                if s:
                    gw[s] += 1.0
    top = [g for g, _ in sorted(gw.items(), key=lambda x: -x[1])[:20]]
    return top, _tokenize_titles(titles)


def _shelf_genres_keywords(user):
    sg, kw = _genres_keywords_from_shelf_types(user, ("book", "movie", "podcast"))
    return sg[:12], kw


def _collect_signals_full(user):
    """Shelf + interests + friends """
    genre_w = defaultdict(float)
    ut = []
    for row in BookShelfItem.objects.filter(user=user).only("genres", "title"):
        ut.append(row.title)
        for g in row.genres or []:
            s = str(g).strip()
            if s:
                genre_w[s] += 3.0
    for row in MovieShelfItem.objects.filter(user=user).only("genres", "title"):
        ut.append(row.title)
        for g in row.genres or []:
            s = str(g).strip()
            if s:
                genre_w[s] += 3.0
    for row in PodcastShelfItem.objects.filter(user=user).only("genres", "title"):
        ut.append(row.title)
        for g in row.genres or []:
            s = str(g).strip()
            if s:
                genre_w[s] += 3.0
    for x in user.interests or []:
        if isinstance(x, str) and x.strip():
            genre_w[x.strip()] += 2.0
    ft = []
    for uid in _friend_ids(user):
        for row in BookShelfItem.objects.filter(user_id=uid).only("genres", "title"):
            ft.append(row.title)
            for g in row.genres or []:
                s = str(g).strip()
                if s:
                    genre_w[s] += 1.0
        for row in MovieShelfItem.objects.filter(user_id=uid).only("genres", "title"):
            ft.append(row.title)
            for g in row.genres or []:
                s = str(g).strip()
                if s:
                    genre_w[s] += 1.0
        for row in PodcastShelfItem.objects.filter(user_id=uid).only("genres", "title"):
            ft.append(row.title)
            for g in row.genres or []:
                s = str(g).strip()
                if s:
                    genre_w[s] += 1.0
    top_genres = [g for g, _ in sorted(genre_w.items(), key=lambda x: -x[1])[:12]]
    keywords = _tokenize_titles(ut + ft)
    return top_genres, keywords


def _tmdb_ids_for_labels(labels, name_to_id):
    ids = []
    for raw in labels:
        key = str(raw).lower().strip()
        key = _TMDB_ALIASES.get(key, key)
        if key in name_to_id:
            ids.append(name_to_id[key])
            continue
        for nm, gid in name_to_id.items():
            if key == nm or key in nm or nm in key:
                ids.append(gid)
                break
    out, seen = [], set()
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out[:3]


def _ln_ids_for_labels(labels, id_to_name):
    out = []
    for label in labels:
        ll = str(label).lower().strip()
        if not ll:
            continue
        for gid, nm in id_to_name.items():
            nl = (nm or "").lower()
            if ll == nl or ll in nl or nl in ll:
                out.append(gid)
                break
    seen, uniq = set(), []
    for i in out:
        if i not in seen:
            seen.add(i)
            uniq.append(i)
    return uniq[:3]


def _book_row(item):
    info = item.get("volumeInfo", {}) if isinstance(item, dict) else {}
    published_year = _safe_year(info.get("publishedDate"))
    categories = info.get("categories", []) or []
    return {
        "type": "book",
        "title": info.get("title"),
        "year": published_year,
        "genres": categories,
        "data": item,
    }


def _movie_row(item):
    if not isinstance(item, dict):
        return None
    release_year = _safe_year(item.get("release_date"))
    gids = item.get("genre_ids", []) or []
    genre_ids = gids if isinstance(gids, list) else []
    return {
        "type": "movie",
        "title": item.get("title"),
        "year": release_year,
        "genres": genre_ids,
        "data": item,
    }


def _podcast_row(item):
    if not isinstance(item, dict):
        return None
    return {
        "type": "podcast",
        "title": item.get("title_original") or item.get("title"),
        "year": None,
        "genres": item.get("genre_ids", []) or [],
        "data": item,
    }


def _take_books(svc, query, seen_b, limit, order_by=None):
    if not query or not str(query).strip():
        return []
    data = svc.search_books(str(query).strip(), max_results=limit + 8, order_by=order_by)
    out = []
    for item in data.get("items") or []:
        bid = (item or {}).get("id")
        if not bid or bid in seen_b:
            continue
        seen_b.add(bid)
        out.append(_book_row(item))
        if len(out) >= limit:
            break
    return out


def _take_movies_discover(tmdb, gids, seen_m, limit):
    out = []
    ddata = tmdb.discover_movies(gids if gids else None, max_results=limit + 8)
    for r in ddata.get("results") or []:
        mid = str(r.get("id", ""))
        if not mid or mid in seen_m:
            continue
        seen_m.add(mid)
        row = _movie_row(r)
        if row:
            out.append(row)
        if len(out) >= limit:
            break
    return out


def _take_movies_search(tmdb, q, seen_m, limit):
    out = []
    sdata = tmdb.search_movies(q or "film", max_results=limit + 8)
    for r in sdata.get("results") or []:
        mid = str(r.get("id", ""))
        if not mid or mid in seen_m:
            continue
        seen_m.add(mid)
        row = _movie_row(r)
        if row:
            out.append(row)
        if len(out) >= limit:
            break
    return out


def _take_podcasts_search(ln, q, seen_p, limit, genre_ids=None):
    out = []
    pdata = ln.search_podcasts(q or "podcast", max_results=10, genre_ids=genre_ids)
    for r in pdata.get("results") or []:
        pid = str((r or {}).get("id", "")).strip()
        if not pid or pid in seen_p:
            continue
        seen_p.add(pid)
        out.append(_podcast_row(r))
        if len(out) >= limit:
            break
    return out


def _take_podcasts_best(ln, genre_id, seen_p, limit):
    out = []
    for r in ln.get_best_podcasts(genre_id=genre_id, max_results=limit + 4):
        if not isinstance(r, dict):
            continue
        pod = r.get("podcast") if isinstance(r.get("podcast"), dict) else r
        pid = str(pod.get("id", "")).strip()
        if not pid or pid in seen_p:
            continue
        seen_p.add(pid)
        out.append(_podcast_row(pod))
        if len(out) >= limit:
            break
    return out


def _friend_shelf_rows(user, limit=36):
    """Real items from friends' shelves."""
    fids = list(_friend_ids(user))
    if not fids:
        return []
    books = list(BookShelfItem.objects.filter(user_id__in=fids).order_by("-updated_at"))
    movies = list(MovieShelfItem.objects.filter(user_id__in=fids).order_by("-updated_at"))
    pods = list(PodcastShelfItem.objects.filter(user_id__in=fids).order_by("-updated_at"))
    merged = sorted(
        [(x.updated_at, "book", x) for x in books]
        + [(x.updated_at, "movie", x) for x in movies]
        + [(x.updated_at, "podcast", x) for x in pods],
        key=lambda t: t[0],
        reverse=True,
    )[:limit]
    rows = []
    for _, kind, item in merged:
        if kind == "book":
            raw_authors = (item.authors or "").split(",") if item.authors else []
            authors = [a.strip() for a in raw_authors if a.strip()]
            vol = {
                "title": item.title,
                "authors": authors,
                "description": "",
                "categories": list(item.genres or []) if isinstance(item.genres, list) else [],
            }
            if item.thumbnail:
                vol["imageLinks"] = {"thumbnail": item.thumbnail, "smallThumbnail": item.thumbnail}
            rows.append({
                "type": "book",
                "title": item.title,
                "year": None,
                "genres": item.genres or [],
                "data": {"id": item.google_books_id, "volumeInfo": vol},
            })
        elif kind == "movie":
            tid = item.tmdb_id or ""
            try:
                mid = int(tid) if str(tid).isdigit() else tid
            except (TypeError, ValueError):
                mid = tid
            poster = (item.poster_url or "").strip()
            full = poster.lower().startswith("http")
            rows.append({
                "type": "movie",
                "title": item.title,
                "year": item.release_year,
                "genres": item.genres or [],
                "data": {
                    "id": mid,
                    "title": item.title,
                    "overview": item.overview or "",
                    "poster_path": "" if full else poster,
                    "poster_url": poster if full else "",
                    "release_date": f"{item.release_year}-01-01" if item.release_year else "",
                    "genre_ids": [],
                },
            })
        else:
            rows.append({
                "type": "podcast",
                "title": item.title,
                "year": None,
                "genres": item.genres or [],
                "data": {
                    "id": item.listen_notes_id,
                    "title": item.title,
                    "title_original": item.title,
                    "publisher_original": item.publisher or "",
                    "publisher": item.publisher or "",
                    "image": item.image or "",
                    "thumbnail": item.image or "",
                    "description_original": "",
                    "genre_ids": [],
                },
            })
    return rows


def _movies_from_book_podcast_shelves(user, seen_m, limit, tmdb):
    """Film ideas grounded in what you read and listen to—your movie shelf never weighs in."""
    sg, skw = _genres_keywords_from_shelf_types(user, ("book", "podcast"))
    if not sg and not skw:
        return []
    tmdb_map = tmdb.get_genre_map()
    gids = _tmdb_ids_for_labels(sg, tmdb_map)
    out = _take_movies_discover(tmdb, gids, seen_m, limit) if gids else []
    if len(out) < max(2, limit // 2) and skw:
        out.extend(_take_movies_search(tmdb, " ".join(skw[:4]), seen_m, limit - len(out)))
    return out


def _books_from_movie_podcast_shelves(user, seen_b, limit, books_svc):
    """Reads that rhyme with your screen and earbuds; books you already own sit this one out."""
    sg, skw = _genres_keywords_from_shelf_types(user, ("movie", "podcast"))
    if not sg and not skw:
        return []
    q = " ".join(sg[:4] + skw[:3]).strip()
    out = _take_books(books_svc, q or "fiction", seen_b, limit)
    if len(out) < max(2, limit // 2) and skw:
        out.extend(_take_books(books_svc, " ".join(skw[:4]), seen_b, limit - len(out)))
    return out


def _podcasts_from_book_movie_shelves(user, seen_p, limit, ln):
    """Shows that feel like a sequel to your stacks and queues—podcasts on your shelf don’t vote here."""
    sg, skw = _genres_keywords_from_shelf_types(user, ("book", "movie"))
    if not sg and not skw:
        return []
    ln_map = ln.get_podcast_genre_id_to_name()
    ln_ids = _ln_ids_for_labels(sg, ln_map)
    q = " ".join(skw[:5]) if skw else "stories"
    return _take_podcasts_search(ln, q, seen_p, limit, genre_ids=ln_ids or None)


def _interleave(books, movies, pods, limit):
    out = []
    i = j = k = 0
    while len(out) < limit and (i < len(books) or j < len(movies) or k < len(pods)):
        if i < len(books):
            out.append(books[i])
            i += 1
        if len(out) >= limit:
            break
        if j < len(movies):
            out.append(movies[j])
            j += 1
        if len(out) >= limit:
            break
        if k < len(pods):
            out.append(pods[k])
            k += 1
    return out


def build_recommendations_for_user(user, per_row=12, mixed_per_type=6, mixed_total=18):
    have_b = set(BookShelfItem.objects.filter(user=user).values_list("google_books_id", flat=True))
    have_m = set(MovieShelfItem.objects.filter(user=user).values_list("tmdb_id", flat=True))
    have_p = set(PodcastShelfItem.objects.filter(user=user).values_list("listen_notes_id", flat=True))

    seen_b = set(have_b)
    seen_m = set(have_m)
    seen_p = set(have_p)

    books_svc = GoogleBooksService()
    tmdb = TMDbService()
    ln = ListenNotesService()
    tmdb_map = tmdb.get_genre_map()
    ln_map = ln.get_podcast_genre_id_to_name()

    interests = _preference_labels(user)

    # Sign-up preferences
    pref_q = " ".join(interests) if interests else ""
    preference_books = _take_books(books_svc, pref_q or "fiction", seen_b, per_row) if pref_q else []
    if not preference_books and interests:
        preference_books = _take_books(books_svc, interests[0], seen_b, per_row)

    pref_gids = _tmdb_ids_for_labels(interests, tmdb_map) if interests else []
    preference_movies = []
    if interests:
        if pref_gids:
            preference_movies = _take_movies_discover(tmdb, pref_gids, seen_m, per_row)
        if len(preference_movies) < per_row // 2:
            preference_movies.extend(
                _take_movies_search(
                    tmdb, " ".join(interests[:3]), seen_m, per_row - len(preference_movies)
                )
            )

    pref_ln = _ln_ids_for_labels(interests, ln_map) if interests else []
    preference_podcasts = []
    if interests:
        preference_podcasts = _take_podcasts_search(
            ln, " ".join(interests[:3]), seen_p, per_row, genre_ids=pref_ln or None
        )

    # Friends shelf
    friends_shelf = _friend_shelf_rows(user, limit=mixed_total + 6)

    # Users shelf
    sg, skw = _shelf_genres_keywords(user)
    sb = _take_books(books_svc, " ".join(sg[:3] + skw[:2]) if (sg or skw) else "", seen_b, mixed_per_type)
    if not sb and skw:
        sb = _take_books(books_svc, " ".join(skw[:3]), seen_b, mixed_per_type)
    sm_gids = _tmdb_ids_for_labels(sg, tmdb_map)
    sm = _take_movies_discover(tmdb, sm_gids, seen_m, mixed_per_type) if sm_gids else []
    if len(sm) < mixed_per_type // 2 and skw:
        sm.extend(_take_movies_search(tmdb, " ".join(skw[:2]), seen_m, mixed_per_type - len(sm)))
    sln = _ln_ids_for_labels(sg, ln_map)
    sp = _take_podcasts_search(
        ln, " ".join(skw[:4]) if skw else "podcast", seen_p, mixed_per_type, genre_ids=sln or None
    )
    shelf_mixed = _interleave(sb, sm, sp, mixed_total)

    # Cross-media
    xn = max(6, min(per_row // 2 + 2, 10))
    cross_movies_from_books_podcasts = _movies_from_book_podcast_shelves(user, seen_m, xn, tmdb)
    cross_books_from_movies_podcasts = _books_from_movie_podcast_shelves(user, seen_b, xn, books_svc)
    cross_podcasts_from_books_movies = _podcasts_from_book_movie_shelves(user, seen_p, xn, ln)

    # shelf, prefereces, friends combined
    top_genres, keywords = _collect_signals_full(user)
    dq = " ".join(top_genres[:4] + keywords[:3]) if (top_genres or keywords) else "popular fiction"
    discover_books = _take_books(books_svc, dq, seen_b, per_row)

    dg = _tmdb_ids_for_labels(top_genres, tmdb_map)
    discover_movies = _take_movies_discover(tmdb, dg, seen_m, per_row)
    if len(discover_movies) < per_row // 2:
        discover_movies.extend(
            _take_movies_search(tmdb, " ".join(keywords[:3]) if keywords else "adventure", seen_m, per_row - len(discover_movies))
        )

    dln = _ln_ids_for_labels(top_genres, ln_map)
    discover_podcasts = _take_podcasts_search(
        ln, " ".join(keywords[:4]) if keywords else "stories", seen_p, per_row, genre_ids=dln or None
    )

    # trending / popular
    popular_books = _take_books(books_svc, "bestseller fiction", seen_b, per_row, order_by="newest")
    popular_movies = _take_movies_discover(tmdb, None, seen_m, per_row)

    best_gid = None
    if top_genres:
        lids = _ln_ids_for_labels(top_genres[:5], ln_map)
        if lids:
            best_gid = lids[0]
    popular_podcasts = _take_podcasts_best(ln, best_gid, seen_p, per_row)
    if len(popular_podcasts) < per_row // 2:
        popular_podcasts.extend(_take_podcasts_best(ln, None, seen_p, per_row - len(popular_podcasts)))

    return {
        "preference_books": preference_books,
        "preference_movies": preference_movies,
        "preference_podcasts": preference_podcasts,
        "friends_shelf": friends_shelf,
        "shelf_mixed": shelf_mixed,
        "cross_movies_from_books_podcasts": cross_movies_from_books_podcasts,
        "cross_books_from_movies_podcasts": cross_books_from_movies_podcasts,
        "cross_podcasts_from_books_movies": cross_podcasts_from_books_movies,
        "discover_books": discover_books,
        "discover_movies": discover_movies,
        "discover_podcasts": discover_podcasts,
        "popular_books": popular_books,
        "popular_movies": popular_movies,
        "popular_podcasts": popular_podcasts,
        "based_on": {
            "interests": interests,
            "top_genres": top_genres[:8],
            "keywords": keywords[:8],
            "friends_count": len(_friend_ids(user)),
        },
    }
