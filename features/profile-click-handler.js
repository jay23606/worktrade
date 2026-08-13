export function createProfileClickHandler({ getState, updateMyProfile, notify, persist, setFollow }) {
  const state = getState();
  return function handleProfileClick(event) {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      const [list, index] = remove.dataset.remove.split(":");
      const profile = structuredClone(state.profile);
      profile[list].splice(Number(index), 1);
      if (state.remote)
        updateMyProfile({
          display_name: profile.name,
          location_text: profile.location,
          bio: profile.bio,
          needs: profile.needs,
          offers: profile.offers,
        })
          .then(() => {
            state.profile = profile;
            notify("Profile updated");
          })
          .catch((error) => notify(error.message));
      else {
        state.profile = profile;
        persist();
      }
    }
    const followPerson = event.target.closest("[data-follow-person]");
    if (followPerson) {
      const id = followPerson.dataset.followPerson;
      const following = state.profile.following || [];
      const shouldFollow = !following.includes(id);
      if (state.remote)
        setFollow(id, shouldFollow)
          .then(() => {
            state.profile = {
              ...state.profile,
              following: shouldFollow
                ? [...following, id]
                : following.filter((x) => x !== id),
            };
            notify(
              shouldFollow ? "Following collaborator" : "Unfollowed collaborator",
            );
          })
          .catch((error) => notify(error.message));
      else {
        state.profile = {
          ...state.profile,
          following: shouldFollow
            ? [...following, id]
            : following.filter((x) => x !== id),
        };
        persist();
        notify("Following updated");
      }
    }
    const circle = event.target.closest("[data-circle]");
    if (circle) {
      const profile = structuredClone(state.profile);
      profile.joinedCircles ||= [];
      profile.joinedCircles = profile.joinedCircles.includes(
        circle.dataset.circle,
      )
        ? profile.joinedCircles.filter((id) => id !== circle.dataset.circle)
        : [...profile.joinedCircles, circle.dataset.circle];
      state.profile = profile;
      persist();
      notify("Circle membership updated");
    }
      };
}

