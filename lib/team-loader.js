import { sanityClient, QUERIES, urlFor } from './sanity.js';

async function loadTeamFromSanity() {
  // Target the container that holds the team grid
  const container = document.querySelector('.elementor-element-585c2fe');
  if (!container) return;

  try {
    // Show a loading state inside console or a loader overlay if needed
    const members = await sanityClient.fetch(QUERIES.allTeamMembers);
    
    // If no members are configured in Sanity, preserve our static high-fidelity fallbacks
    if (!members || members.length === 0) {
      console.log('No team members found in Sanity. Keeping high-fidelity static fallbacks.');
      return;
    }

    console.log(`Loaded ${members.length} team members from Sanity Studio.`);
    
    // Group members by their teamType
    const advisoryMembers = members.filter(m => m.teamType === 'advisory');
    const fieldMembers = members.filter(m => m.teamType === 'field');

    // Reconstruct the team grid dynamically
    let gridHtml = `
      <div class="container py-5">
    `;

    // 1. Render Advisory Board
    if (advisoryMembers.length > 0) {
      gridHtml += `
        <div class="row text-center mb-5">
            <div class="col-12">
                <span class="text-uppercase tracking-wider font-weight-bold" style="color: #b83b1d; letter-spacing: 2px; font-size: 0.9rem;">Governance</span>
                <h2 class="display-4 font-weight-bold mt-2" style="font-family: inherit; color: #1e1e1e;">Advisory Board Members</h2>
                <div class="mx-auto my-3" style="width: 80px; height: 3px; background: #b83b1d;"></div>
            </div>
        </div>
        <div class="row justify-content-center">
      `;

      advisoryMembers.forEach(m => {
        const imgUrl = m.photo ? urlFor(m.photo).url() : '/content/uploads/2026/04/Rectangle-2.jpg';
        gridHtml += `
          <div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-5">
              <div class="pt-team-box pt-style-1 text-center" style="box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; background: #fff; padding-bottom: 25px; transition: all 0.3s ease; height: 100%;">
                  <div class="pt-team-image-wrapper" style="position: relative; overflow: hidden; border-bottom: 3px solid #b83b1d; height: 260px;">
                      <div class="pt-team-media" style="height: 100%; display: flex; align-items: center; justify-content: center; background: #fafafa;">
                          <img alt="${m.name}" class="pt-team-img" src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy" />
                      </div>
                  </div>
                  <div class="pt-team-info" style="padding: 20px 15px 5px 15px;">
                      <h4 class="pt-team-title" style="font-size: 1.15rem; font-weight: 700; margin-bottom: 5px; color: #1e1e1e;">
                          ${m.name}
                      </h4>
                      <span class="pt-team-designation" style="font-size: 0.85rem; font-weight: 500; color: #b83b1d; line-height: 1.3; display: block; min-height: 40px;">
                          ${m.role}
                      </span>
                  </div>
              </div>
          </div>
        `;
      });
      gridHtml += `</div>`;
    }

    // 2. Render Chitral Field Team
    if (fieldMembers.length > 0) {
      gridHtml += `
        <div class="row text-center mt-5 mb-5">
            <div class="col-12">
                <span class="text-uppercase tracking-wider font-weight-bold" style="color: #b83b1d; letter-spacing: 2px; font-size: 0.9rem;">Field Operations</span>
                <h2 class="display-4 font-weight-bold mt-2" style="font-family: inherit; color: #1e1e1e;">Chitral Field Team</h2>
                <div class="mx-auto my-3" style="width: 80px; height: 3px; background: #b83b1d;"></div>
            </div>
        </div>
        <div class="row justify-content-center">
      `;

      fieldMembers.forEach(m => {
        const imgUrl = m.photo ? urlFor(m.photo).url() : '/content/uploads/2026/04/Rectangle-2.jpg';
        gridHtml += `
          <div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-5">
              <div class="pt-team-box pt-style-1 text-center" style="box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; background: #fff; padding-bottom: 25px; transition: all 0.3s ease; height: 100%;">
                  <div class="pt-team-image-wrapper" style="position: relative; overflow: hidden; border-bottom: 3px solid #b83b1d; height: 260px;">
                      <div class="pt-team-media" style="height: 100%; display: flex; align-items: center; justify-content: center; background: #fafafa;">
                          <img alt="${m.name}" class="pt-team-img" src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy" />
                      </div>
                  </div>
                  <div class="pt-team-info" style="padding: 20px 15px 5px 15px;">
                      <h4 class="pt-team-title" style="font-size: 1.15rem; font-weight: 700; margin-bottom: 5px; color: #1e1e1e;">
                          ${m.name}
                      </h4>
                      <span class="pt-team-designation" style="font-size: 0.85rem; font-weight: 500; color: #b83b1d; line-height: 1.3; display: block; min-height: 40px;">
                          ${m.role}
                      </span>
                  </div>
              </div>
          </div>
        `;
      });
      gridHtml += `</div>`;
    }

    gridHtml += `</div>`;

    // Clear previous elements and render dynamic grid
    container.innerHTML = gridHtml;

  } catch (err) {
    console.error('Failed to load team members from Sanity Studio:', err);
  }
}

// Fire loading procedure
document.addEventListener('DOMContentLoaded', loadTeamFromSanity);
